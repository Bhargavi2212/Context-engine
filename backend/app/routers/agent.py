"""Agent chat API: POST /chat, GET /conversations, GET /conversations/{id}, DELETE /conversations/{id}."""
import logging
import time
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.agents.router import graph
from app.config import settings

logger = logging.getLogger(__name__)
from app.agents.state import AgentState
from app.database import get_db
from app.dependencies import get_current_user
from app.models.schemas import CurrentUser
from app.services import conversation_service, product_context_service, monitoring_service

router = APIRouter(prefix="/agent", tags=["agent"])


@router.post("/chat")
async def agent_chat(
    body: dict,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
):
    """Send a message to the agent and get a response."""
    message = body.get("message")
    conversation_id = body.get("conversation_id")

    if not message or not isinstance(message, str) or not message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="message is required")

    conversation = conversation_service.load_or_create_conversation(conn, current_user, conversation_id)
    conversation["messages"].append({
        "role": "user",
        "content": message.strip(),
        "timestamp": datetime.utcnow().isoformat(),
    })

    product_context = product_context_service.get_all_for_org(conn, current_user.org_id)
    state: AgentState = {
        "messages": conversation["messages"],
        "intent": "",
        "agent_response": "",
        "org_id": current_user.org_id,
        "product_context": product_context,
        "conn": conn,
    }

    try:
        t0 = time.perf_counter()
        result = await graph.ainvoke(state)
        latency_ms = int((time.perf_counter() - t0) * 1000)
        intent = result.get("intent") or "general"
        monitoring_service.log_agent_call(
            conn, current_user.org_id,
            agent_type=intent,
            tool_used=intent,
            latency_ms=latency_ms,
            model="mistral-medium",
        )
    except Exception as e:
        logger.exception("Agent chat failed: %s", e)
        detail = "Agent failed. Check server logs."
        if not (settings.mistral_api_key and settings.mistral_api_key.strip()):
            detail = "Mistral API key not configured. Set MISTRAL_API_KEY in .env."
        else:
            err_str = str(e).lower()
            if "429" in err_str or "capacity exceeded" in err_str or "rate" in err_str or "service_tier" in err_str:
                detail = "Mistral rate limit or capacity exceeded. Try again in a moment or check your plan limits."
            elif "api_key" in err_str or "unauthorized" in err_str or "401" in err_str:
                detail = "Mistral API key invalid or expired. Check MISTRAL_API_KEY."
            elif "timeout" in err_str:
                detail = "Request timed out. Try a shorter question."
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=detail)

    conversation["messages"].append({
        "role": "assistant",
        "content": result.get("agent_response", ""),
        "timestamp": datetime.utcnow().isoformat(),
        "intent": result.get("intent", ""),
    })
    conversation_service.save_conversation(conn, conversation)

    return {
        "data": {
            "response": result.get("agent_response", ""),
            "intent": result.get("intent", ""),
            "conversation_id": conversation["id"],
        }
    }


@router.get("/conversations")
async def list_conversations(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
):
    """List past conversations for the current user."""
    items = conversation_service.list_conversations(conn, current_user.org_id, current_user.user_id)
    return {"data": items}


@router.get("/conversations/{conversation_id}")
async def get_conversation(
    conversation_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
):
    """Get a single conversation by id."""
    conv = conversation_service.get_conversation(conn, current_user.org_id, conversation_id)
    if not conv:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    if conv.get("user_id") != current_user.user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"data": conv}


@router.delete("/conversations/{conversation_id}")
async def delete_conversation(
    conversation_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    conn: Annotated = Depends(get_db),
):
    """Delete a conversation."""
    deleted = conversation_service.delete_conversation(
        conn, current_user.org_id, current_user.user_id, conversation_id
    )
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Conversation not found")
    return {"data": {"deleted": True}}
