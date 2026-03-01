"""Classification pipeline: Mistral chat for feedback classification."""
import asyncio
import json
import logging
from typing import Any

from app.config import settings

logger = logging.getLogger(__name__)

REQUIRED_FIELDS = ["is_feedback", "feedback_type", "sentiment", "sentiment_score", "confidence"]


def _classify_sync(text: str, product_context: dict[str, Any]) -> dict[str, Any]:
    """Synchronous Mistral call. Wrapped in asyncio.to_thread."""
    from mistralai import Mistral

    areas_with_desc: list[str] = []
    for item in product_context.get("product_area", []):
        if isinstance(item.get("data"), dict) and item["data"].get("name"):
            name = item["data"]["name"]
            desc = (item["data"].get("description") or "").strip()
            areas_with_desc.append(f"{name}: {desc}" if desc else name)
    teams = [
        item["data"]["name"]
        for item in product_context.get("team", [])
        if isinstance(item.get("data"), dict) and item["data"].get("name")
    ]
    products = "Unknown"
    basics = product_context.get("product_basics") or {}
    if isinstance(basics, dict):
        products = basics.get("product_name", "Unknown")

    areas_bullet = "\n".join(f"- {a}" for a in areas_with_desc) if areas_with_desc else "Not specified"
    prompt = f"""Classify this customer feedback. Return ONLY valid JSON, no other text.

## Product Context
Product: {products}
Product Areas (choose the best match):
{areas_bullet}
Teams: {', '.join(teams) if teams else 'Not specified'}

## Feedback Text
"{text[:2000]}"

## Return this exact JSON structure:
{{
  "is_feedback": true/false,
  "feedback_type": "bug_report" | "feature_request" | "complaint" | "praise" | "question" | "noise",
  "sentiment": "positive" | "negative" | "neutral",
  "sentiment_score": -1.0 to 1.0,
  "product": "product name or null",
  "feature_area": "one of the product areas or null",
  "team": "one of the teams or null",
  "urgency": "low" | "medium" | "high" | "critical",
  "confidence": 0.0 to 1.0
}}

## Classification Rules:
- is_feedback = false for: greetings, meeting scheduling, casual chat, automated notifications, "ok", "thanks", "sounds good"
- is_feedback = true for: bug reports, feature requests, complaints, praise, questions about the product
- urgency = "critical" if: mentions switching to competitor, legal threat, data loss, security issue
- urgency = "high" if: mentions lost deal, approaching deadline, multiple users affected
- feature_area: Pick the BEST matching product area from the list. Always choose one even if the match isn't perfect — only return null if the feedback is completely unrelated to any product area. When in doubt, pick the closest match. Use the exact area name (the part before the colon) when returning.
- team must be one of the teams listed above, or null if unclear
- confidence reflects how certain you are about the classification overall"""

    client = Mistral(api_key=settings.mistral_api_key)
    response = client.chat.complete(
        model="mistral-medium-latest",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.1,
    )
    content = response.choices[0].message.content
    result = json.loads(content)
    # If model returned "Name: description", store only the area name
    if result.get("feature_area") and ":" in str(result["feature_area"]):
        result["feature_area"] = str(result["feature_area"]).split(":")[0].strip() or None
    return result


async def classify_feedback(text: str, product_context: dict[str, Any]) -> dict[str, Any]:
    """Classify a single feedback item using Mistral (runs sync call in thread)."""
    return await asyncio.to_thread(_classify_sync, text, product_context)


async def classify_with_fallback(text: str, product_context: dict[str, Any]) -> dict[str, Any]:
    """Classify with fallback defaults if Mistral call fails or result is invalid."""
    if not (text and isinstance(text, str) and text.strip()):
        return {
            "is_feedback": True,
            "feedback_type": "unknown",
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "product": None,
            "feature_area": None,
            "team": None,
            "urgency": "medium",
            "confidence": 0.0,
        }
    try:
        result = await classify_feedback(text.strip(), product_context)
        for field in REQUIRED_FIELDS:
            if field not in result:
                raise ValueError(f"Missing field: {field}")
        return result
    except Exception as e:
        logger.error("Classification failed for text: %s... Error: %s", (text[:100] if text else ""), e)
        return {
            "is_feedback": True,
            "feedback_type": "unknown",
            "sentiment": "neutral",
            "sentiment_score": 0.0,
            "product": None,
            "feature_area": None,
            "team": None,
            "urgency": "medium",
            "confidence": 0.0,
        }
