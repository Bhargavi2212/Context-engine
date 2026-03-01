"""Conversation service: load, create, save, list, get, delete for agent chat."""
import json
import uuid
from typing import Any


def load_or_create_conversation(
    conn: Any,
    user: Any,
    conversation_id: str | None = None,
) -> dict[str, Any]:
    """Load existing conversation by id+org_id or create new. Returns { id, messages, user_id }."""
    if conversation_id:
        cursor = conn.execute(
            "SELECT id, messages, user_id FROM conversations WHERE id = ? AND org_id = ?",
            (conversation_id, user.org_id),
        )
        row = cursor.fetchone()
        if row:
            messages = json.loads(row["messages"]) if row["messages"] else []
            return {
                "id": row["id"],
                "org_id": user.org_id,
                "messages": messages,
                "user_id": row["user_id"],
            }

    conv_id = str(uuid.uuid4())
    conn.execute(
        "INSERT INTO conversations (id, org_id, user_id, messages) VALUES (?, ?, ?, ?)",
        (conv_id, user.org_id, user.user_id, "[]"),
    )
    conn.commit()
    return {"id": conv_id, "org_id": user.org_id, "messages": [], "user_id": user.user_id}


def save_conversation(conn: Any, conversation: dict[str, Any]) -> None:
    """Update conversation messages and title from first user message."""
    org_id = conversation.get("org_id")
    if not org_id:
        return
    messages = conversation.get("messages") or []
    messages_json = json.dumps(messages)
    title = None
    for m in messages:
        if m.get("role") == "user" and m.get("content"):
            title = (m["content"] or "").strip()[:60]
            if len((m["content"] or "").strip()) > 60:
                title = title.rstrip() + "…"
            break
    if title:
        conn.execute(
            "UPDATE conversations SET messages = ?, title = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?",
            (messages_json, title, conversation["id"], org_id),
        )
    else:
        conn.execute(
            "UPDATE conversations SET messages = ?, updated_at = datetime('now') WHERE id = ? AND org_id = ?",
            (messages_json, conversation["id"], org_id),
        )
    conn.commit()


def list_conversations(conn: Any, org_id: str, user_id: str) -> list[dict[str, Any]]:
    """List conversations for user/org (for dropdown). Title from first user message or stored title."""
    cursor = conn.execute(
        """SELECT id, title, messages, created_at FROM conversations
           WHERE org_id = ? AND user_id = ? ORDER BY updated_at DESC""",
        (org_id, user_id),
    )
    rows = cursor.fetchall()
    result = []
    for row in rows:
        messages = json.loads(row["messages"]) if row["messages"] else []
        first_content = ""
        for m in messages:
            if m.get("role") == "user" and m.get("content"):
                first_content = (m["content"] or "").strip()[:80]
                if len((m["content"] or "").strip()) > 80:
                    first_content = first_content.rstrip() + "…"
                break
        stored_title = (row["title"] or "").strip()
        if stored_title and stored_title != "New Conversation":
            title = stored_title
        else:
            title = first_content if first_content else "New conversation"
        result.append({
            "id": row["id"],
            "title": title,
            "created_at": row["created_at"],
        })
    return result


def get_conversation(conn: Any, org_id: str, conversation_id: str) -> dict[str, Any] | None:
    """Get one conversation by id and org_id."""
    cursor = conn.execute(
        "SELECT id, org_id, user_id, messages, title FROM conversations WHERE id = ? AND org_id = ?",
        (conversation_id, org_id),
    )
    row = cursor.fetchone()
    if not row:
        return None
    messages = json.loads(row["messages"]) if row["messages"] else []
    return {
        "id": row["id"],
        "org_id": row["org_id"],
        "user_id": row["user_id"],
        "messages": messages,
        "title": row["title"],
    }


def delete_conversation(
    conn: Any,
    org_id: str,
    user_id: str,
    conversation_id: str,
) -> bool:
    """Delete conversation if owned. Returns True if deleted."""
    cursor = conn.execute(
        "DELETE FROM conversations WHERE id = ? AND org_id = ? AND user_id = ?",
        (conversation_id, org_id, user_id),
    )
    conn.commit()
    return cursor.rowcount > 0
