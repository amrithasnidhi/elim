import os
from typing import Optional, TYPE_CHECKING

from services.mcp_manager import TRUST_WEIGHTS

# Lazy imports — packages may not be installed in all environments
try:
    import chromadb
    _CHROMA_OK = True
except ImportError:
    _CHROMA_OK = False

try:
    import tiktoken
    _TIKTOKEN_OK = True
except ImportError:
    _TIKTOKEN_OK = False

try:
    from openai import AsyncOpenAI
    _OPENAI_OK = True
except ImportError:
    _OPENAI_OK = False

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50
SIMILARITY_THRESHOLD = 0.72
TOP_K = 5
EMBEDDING_MODEL = "text-embedding-3-small"
BATCH_SIZE = 100


def _make_chroma_client():
    host = os.getenv("CHROMADB_HOST", "")
    if host and host not in ("localhost", "embedded"):
        port = int(os.getenv("CHROMADB_PORT", "8001"))
        return chromadb.HttpClient(host=host, port=port)
    path = os.getenv("CHROMADB_PATH", "./chromadb_data")
    return chromadb.PersistentClient(path=path)


class RAGPipeline:
    def __init__(self, openai_api_key: str):
        if not (_CHROMA_OK and _TIKTOKEN_OK and _OPENAI_OK):
            raise RuntimeError("chromadb, tiktoken, and openai packages are required for RAGPipeline")
        self._openai_key = openai_api_key
        self._enc = tiktoken.get_encoding("cl100k_base")
        self._chroma = _make_chroma_client()

    # ── Collections ──────────────────────────────────────────────────────────

    def _collection(self, user_id: str):
        return self._chroma.get_or_create_collection(
            name=f"user_{user_id}",
            metadata={"hnsw:space": "cosine"},
        )

    # ── Chunking ─────────────────────────────────────────────────────────────

    def chunk_text(self, text: str) -> list[str]:
        tokens = self._enc.encode(text)
        chunks: list[str] = []
        start = 0
        while start < len(tokens):
            end = min(start + CHUNK_SIZE, len(tokens))
            chunks.append(self._enc.decode(tokens[start:end]))
            if end == len(tokens):
                break
            start += CHUNK_SIZE - CHUNK_OVERLAP
        return [c for c in chunks if c.strip()]

    # ── Embeddings ───────────────────────────────────────────────────────────

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        client = AsyncOpenAI(api_key=self._openai_key)
        embeddings: list[list[float]] = []
        for i in range(0, len(texts), BATCH_SIZE):
            batch = texts[i : i + BATCH_SIZE]
            resp = await client.embeddings.create(model=EMBEDDING_MODEL, input=batch)
            embeddings.extend(item.embedding for item in resp.data)
        return embeddings

    # ── Index ─────────────────────────────────────────────────────────────────

    async def index_documents(self, user_id: str, source: str, documents: list[dict]) -> int:
        """Chunk, embed, and upsert into ChromaDB. Returns number of chunks stored."""
        col = self._collection(user_id)

        # Clear old chunks for this source
        try:
            existing = col.get(where={"source": source})
            if existing["ids"]:
                col.delete(ids=existing["ids"])
        except Exception:
            pass

        all_texts: list[str] = []
        all_metas: list[dict] = []
        for doc in documents:
            text = doc.get("text", "").strip()
            if not text:
                continue
            for idx, chunk in enumerate(self.chunk_text(text)):
                all_texts.append(chunk)
                all_metas.append({
                    "source": source,
                    "doc_title": doc.get("title", "")[:200],
                    "chunk_idx": idx,
                })

        if not all_texts:
            return 0

        embeddings = await self.embed_texts(all_texts)
        ids = [f"{user_id}__{source}__{i}" for i in range(len(all_texts))]
        col.upsert(ids=ids, documents=all_texts, embeddings=embeddings, metadatas=all_metas)
        return len(all_texts)

    # ── Search ────────────────────────────────────────────────────────────────

    async def search(
        self,
        user_id: str,
        topic: str,
        enabled_sources: Optional[list[str]] = None,
        n_results: int = TOP_K,
    ) -> list[dict]:
        """Semantic search: embed topic → cosine similarity → trust-weighted re-ranking."""
        col = self._collection(user_id)
        if col.count() == 0:
            return []

        query_emb = await self.embed_texts([topic])
        sources = [s for s in (enabled_sources or []) if s != "web"]
        where = {"source": {"$in": sources}} if sources else None

        try:
            raw = col.query(
                query_embeddings=query_emb,
                n_results=min(n_results * 2, col.count()),
                where=where,
                include=["documents", "distances", "metadatas"],
            )
        except Exception:
            return []

        if not raw["documents"] or not raw["documents"][0]:
            return []

        chunks: list[dict] = []
        for doc, dist, meta in zip(
            raw["documents"][0],
            raw["distances"][0],
            raw["metadatas"][0],
        ):
            sim = max(0.0, 1.0 - dist)
            if sim < SIMILARITY_THRESHOLD:
                continue
            src = meta.get("source", "web")
            trust = TRUST_WEIGHTS.get(src, 0.60)
            chunks.append({
                "text": doc,
                "source": src,
                "similarity": round(sim, 4),
                "trust": trust,
                "rank": round(sim * trust, 4),
                "doc_title": meta.get("doc_title", ""),
            })

        chunks.sort(key=lambda c: c["rank"], reverse=True)
        return chunks[:n_results]

    # ── Utilities ─────────────────────────────────────────────────────────────

    def delete_source(self, user_id: str, source: str) -> None:
        try:
            col = self._collection(user_id)
            existing = col.get(where={"source": source})
            if existing["ids"]:
                col.delete(ids=existing["ids"])
        except Exception:
            pass

    def chunk_count(self, user_id: str, source: Optional[str] = None) -> int:
        try:
            col = self._collection(user_id)
            if source:
                return len(col.get(where={"source": source})["ids"])
            return col.count()
        except Exception:
            return 0

    def get_chunks(self, user_id: str, source: Optional[str] = None, offset: int = 0, limit: int = 20) -> list[dict]:
        try:
            col = self._collection(user_id)
            where = {"source": source} if source else None
            result = col.get(where=where, include=["documents", "metadatas"])
            items = list(zip(result["ids"], result["documents"], result["metadatas"]))
            items = items[offset : offset + limit]
            return [
                {"id": i, "text": d[:300], "source": m.get("source"), "doc_title": m.get("doc_title", "")}
                for i, d, m in items
            ]
        except Exception:
            return []


def get_rag_pipeline() -> Optional[RAGPipeline]:
    if not (_CHROMA_OK and _TIKTOKEN_OK and _OPENAI_OK):
        return None
    key = os.getenv("OPENAI_API_KEY")
    return RAGPipeline(openai_api_key=key) if key else None
