# Production single-container build: backend + frontend static files
FROM python:3.11-slim

# Install Node.js and npm for frontend build
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Backend
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt

# Frontend: copy and build (use relative API base for same-origin in prod)
COPY frontend/ ./frontend/
ENV VITE_API_BASE_URL=/api/v1
RUN cd frontend && npm ci && npm run build

# Copy backend and place frontend dist into backend static
COPY backend/ ./backend/
RUN mkdir -p backend/app/static && cp -r frontend/dist/* backend/app/static/

# Project files
COPY PROJECT.md .env.example ./

# Data directory for SQLite
RUN mkdir -p /app/data

WORKDIR /app/backend

# Run without --reload in production
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
