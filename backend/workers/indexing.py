import asyncio
import os
from datetime import datetime, timezone

import pymongo
from bson import ObjectId

from workers.celery_app import celery_app
from services.mcp_manager import MCPManager
from services.rag_pipeline import RAGPipeline

# Broad queries that encourage the MCP source to surface all available content
_INDEX_QUERIES = [
    "list all documents, notes, and files with their full text content",
    "retrieve all study notes, lecture notes, and educational materials",
    "show all code files, algorithms, and technical documentation",
]


def _sync_db():
    uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
    db_name = os.getenv("DATABASE_NAME", "elim")
    return pymongo.MongoClient(uri)[db_name]


@celery_app.task(bind=True, name="workers.indexing.index_source")
def index_source(self, user_id: str, source: str):
    self.update_state(state="PROGRESS", meta={"progress_pct": 5, "files_indexed": 0, "status": "loading"})

    db = _sync_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        return {"error": "User not found", "files_indexed": 0}

    tokens: dict = user.get("mcp_tokens", {})
    enabled = [source]

    self.update_state(state="PROGRESS", meta={"progress_pct": 15, "files_indexed": 0, "status": "fetching"})

    async def fetch():
        mgr = MCPManager(enabled, tokens)
        all_chunks: list[dict] = []
        for q in _INDEX_QUERIES:
            results = await mgr._query_source(source, q)
            all_chunks.extend(results)
        return mgr._deduplicate(all_chunks)

    try:
        raw_docs = asyncio.run(fetch())
    except Exception as e:
        return {"error": f"MCP fetch failed: {e}", "files_indexed": 0}

    self.update_state(state="PROGRESS", meta={"progress_pct": 45, "files_indexed": 0, "status": "embedding"})

    # Use Gemini for embeddings
    gemini_key = os.getenv("GEMINI_API_KEY")
    if not gemini_key or not raw_docs:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {"$set": {f"mcp_last_indexed.{source}": datetime.now(timezone.utc).isoformat()}},
        )
        return {"progress_pct": 100, "files_indexed": 0, "status": "done"}

    documents = [{"text": d["text"], "title": d.get("source", source)} for d in raw_docs]

    async def run_rag():
        pipeline = RAGPipeline(gemini_api_key=gemini_key)
        return await pipeline.index_documents(user_id, source, documents)

    try:
        chunk_count = asyncio.run(run_rag())
    except Exception as e:
        return {"error": f"Embedding failed: {e}", "files_indexed": 0}

    self.update_state(state="PROGRESS", meta={"progress_pct": 95, "files_indexed": chunk_count, "status": "saving"})

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {
            f"mcp_last_indexed.{source}": datetime.now(timezone.utc).isoformat(),
            f"mcp_doc_counts.{source}": chunk_count,
        }},
    )

    return {"progress_pct": 100, "files_indexed": chunk_count, "status": "done"}
