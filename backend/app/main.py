"""FastAPI app: lifespan, CORS, routers."""
import json
import logging
import re
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.config import settings
from app.database import init_db, get_db_sync, verify_mistral_connection
from app.routers import agent, auth, dashboard, feedback, customers, health, product_context, onboarding, upload, specs, connectors, monitoring
from app.services import connector_service

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# Allow these origins for CORS (used by fallback middleware)
_LOCALHOST_ORIGIN_REGEX = re.compile(
    r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$", re.IGNORECASE
)


class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    """Ensure CORS headers are on every response (safety net for 401/500 etc)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        origin = request.headers.get("origin")
        if not origin:
            return response
        if origin in settings.cors_origins or _LOCALHOST_ORIGIN_REGEX.match(origin):
            if "access-control-allow-origin" not in {
                k.lower() for k in response.headers.keys()
            }:
                response.headers["Access-Control-Allow-Origin"] = origin
                response.headers["Vary"] = "Origin"
        return response


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: init DB, verify Mistral, restore connectors. Shutdown: cancel connector tasks."""
    logger.info("Starting Context Engine (Mistral Edition)...")
    init_db()
    mistral_ok = await verify_mistral_connection()
    if mistral_ok:
        logger.info("Mistral AI connection verified")
    else:
        logger.warning("Mistral AI connection failed — check MISTRAL_API_KEY")

    # Restore active Slack connectors (simulated and live)
    db = get_db_sync()
    try:
        cursor = db.execute("SELECT id, org_id, type, config FROM connectors WHERE status = 'connected'")
        rows = cursor.fetchall()
        restored = 0
        for row in rows:
            if row["type"] != "slack":
                continue
            try:
                config = json.loads(row["config"]) if row["config"] else {}
                connector_service.start_restored_poller(row["id"], row["org_id"], config)
                restored += 1
            except Exception as e:
                logger.warning("Failed to restore connector %s: %s", row["id"][:8], e)
        if restored:
            logger.info("Restored %d Slack connector(s)", restored)
    finally:
        db.close()

    yield

    # Shutdown: cancel all connector polling tasks
    for cid, task in list(connector_service.get_poll_tasks().items()):
        task.cancel()
        logger.info("Cancelled connector task %s", cid[:8])
    logger.info("Shutting down Context Engine")


app = FastAPI(
    title="Context Engine",
    description="Feedback intelligence platform for Product Managers",
    version="0.1.0",
    lifespan=lifespan,
)

# Add fallback CORS first (runs last on response) so every response gets headers
app.add_middleware(EnsureCORSHeadersMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(dashboard.router, prefix=settings.api_v1_prefix)
app.include_router(product_context.router, prefix=settings.api_v1_prefix)
app.include_router(onboarding.router, prefix=settings.api_v1_prefix)
app.include_router(upload.router, prefix=settings.api_v1_prefix)
app.include_router(feedback.router, prefix=settings.api_v1_prefix)
app.include_router(customers.router, prefix=settings.api_v1_prefix)
app.include_router(specs.router, prefix=settings.api_v1_prefix)
app.include_router(connectors.router, prefix=settings.api_v1_prefix)
app.include_router(monitoring.router, prefix=settings.api_v1_prefix)
app.include_router(agent.router, prefix=settings.api_v1_prefix)

# Production: serve frontend static files (SPA)
_static_dir = Path(__file__).resolve().parent / "static"
if _static_dir.is_dir():
    _assets_dir = _static_dir / "assets"
    if _assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """Serve index.html for non-API routes (SPA fallback)."""
        if full_path.startswith("api"):
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Not found")
        index_path = _static_dir / "index.html"
        if index_path.is_file():
            return FileResponse(str(index_path))
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found")
