import asyncio
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

# MCP URLs - Slack removed (not needed for Phase 1-8)
MCP_URLS: dict[str, str] = {
    "gdrive": "https://drivemcp.googleapis.com/mcp/v1",
    "notion": "https://mcp.notion.com/mcp",
    "github": "https://api.githubcopilot.com/mcp/",
}

TRUST_WEIGHTS: dict[str, float] = {
    "gdrive": 1.0,
    "notion": 1.0,
    "github": 0.85,
    "web": 0.60,
}

SOURCE_LABELS: dict[str, str] = {
    "gdrive": "Google Drive",
    "notion": "Notion",
    "github": "GitHub",
    "web": "Web Search",
}


def _get_fernet() -> Optional[Fernet]:
    key = os.getenv("ENCRYPTION_KEY", "")
    if not key:
        return None
    try:
        return Fernet(key.encode())
    except Exception:
        return None


def encrypt_token(token: str) -> str:
    f = _get_fernet()
    if not f:
        raise ValueError("ENCRYPTION_KEY not configured")
    return f.encrypt(token.encode()).decode()


def decrypt_token(encrypted: str) -> str:
    f = _get_fernet()
    if not f:
        raise ValueError("ENCRYPTION_KEY not configured")
    return f.decrypt(encrypted.encode()).decode()


class MCPManager:
    """
    MCP (Model Context Protocol) Manager for querying external knowledge sources.

    Note: MCP queries require ANTHROPIC_API_KEY. If not set, queries will return empty results
    silently. This is expected behavior when using Groq fallback for LLM - MCP features
    won't be available but the app will still function.
    """

    def __init__(self, enabled_sources: list[str], encrypted_tokens: dict[str, str]):
        self.sources = [s for s in enabled_sources if s in (*MCP_URLS.keys(), "web")]
        f = _get_fernet()
        self.tokens: dict[str, str] = {}
        if f:
            for k, v in encrypted_tokens.items():
                if k in enabled_sources:
                    try:
                        self.tokens[k] = f.decrypt(v.encode()).decode()
                    except (InvalidToken, Exception):
                        pass

    async def search(self, topic: str) -> list[dict]:
        tasks = [self._query_source(src, topic) for src in self.sources]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        flat = [
            item
            for sublist in results
            if isinstance(sublist, list)
            for item in sublist
        ]
        return self._deduplicate(flat)

    async def _query_source(self, source: str, topic: str) -> list[dict]:
        if source == "web":
            return await self._web_search(topic)
        token = self.tokens.get(source)
        if not token:
            return []

        # MCP requires Anthropic API key
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not anthropic_key:
            return []  # MCP not available without Anthropic

        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=anthropic_key)
            resp = await client.beta.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=2000,
                mcp_servers=[{
                    "type": "url",
                    "url": MCP_URLS[source],
                    "name": source,
                    "authorization_token": token,
                }],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Search for and retrieve all content relevant to: {topic}. "
                        "Return the raw text content found."
                    ),
                }],
                betas=["mcp-client-2025-04-04"],
            )
            text = " ".join(b.text for b in resp.content if hasattr(b, "text")).strip()
            if not text:
                return []
            return [{"text": text, "source": source, "trust": TRUST_WEIGHTS[source]}]
        except Exception:
            return []

    async def _web_search(self, topic: str) -> list[dict]:
        """Web search using Anthropic's built-in tool. Requires ANTHROPIC_API_KEY."""
        anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
        if not anthropic_key:
            return []  # Web search not available without Anthropic

        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=anthropic_key)
            resp = await client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1500,
                tools=[{"type": "web_search_20250305", "name": "web_search", "max_uses": 3}],
                messages=[{
                    "role": "user",
                    "content": (
                        f"Search for educational content about: {topic}. "
                        "Focus on reliable sources like Wikipedia, MDN, GeeksForGeeks, ArXiv."
                    ),
                }],
            )
            text = " ".join(b.text for b in resp.content if hasattr(b, "text")).strip()
            if not text:
                return []
            return [{"text": text, "source": "web", "trust": 0.60}]
        except Exception:
            return []

    @staticmethod
    def _deduplicate(items: list[dict]) -> list[dict]:
        seen: set[str] = set()
        result: list[dict] = []
        for item in items:
            h = hashlib.sha256(item["text"][:200].encode()).hexdigest()
            if h not in seen:
                seen.add(h)
                result.append(item)
        return result

    @staticmethod
    def build_context_string(chunks: list[dict]) -> str:
        if not chunks:
            return ""
        parts = []
        for c in chunks:
            label = SOURCE_LABELS.get(c["source"], c["source"])
            parts.append(f"[From {label}]\n{c['text'][:800]}")
        return "\n\n".join(parts)
