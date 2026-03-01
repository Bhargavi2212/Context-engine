"""Embedding pipeline: Mistral Embed for semantic search."""
import asyncio
from typing import List

import numpy as np

from app.config import settings


def _embed_text_sync(text: str) -> List[float]:
    """Synchronous Mistral Embed call."""
    from mistralai import Mistral

    client = Mistral(api_key=settings.mistral_api_key)
    response = client.embeddings.create(model="mistral-embed", inputs=[text])
    return response.data[0].embedding


def _embed_batch_sync(texts: List[str], batch_size: int = 10) -> List[List[float]]:
    """Synchronous batch embed call."""
    from mistralai import Mistral

    client = Mistral(api_key=settings.mistral_api_key)
    all_embeddings: List[List[float]] = []
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        response = client.embeddings.create(model="mistral-embed", inputs=batch)
        all_embeddings.extend([item.embedding for item in response.data])
    return all_embeddings


async def embed_text(text: str) -> List[float]:
    """Generate 1024-dim embedding for a text (runs sync call in thread)."""
    return await asyncio.to_thread(_embed_text_sync, text)


async def embed_batch(texts: List[str], batch_size: int = 10) -> List[List[float]]:
    """Embed multiple texts in batches (runs sync call in thread)."""
    return await asyncio.to_thread(_embed_batch_sync, texts, batch_size)


def serialize_embedding(embedding: List[float]) -> bytes:
    """Convert embedding list to bytes for SQLite BLOB storage."""
    return np.array(embedding, dtype=np.float32).tobytes()


def deserialize_embedding(blob: bytes) -> np.ndarray:
    """Convert SQLite BLOB back to numpy array."""
    return np.frombuffer(blob, dtype=np.float32)
