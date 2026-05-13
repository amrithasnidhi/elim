import asyncio
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

MCP_URLS: dict[str, str] = {
    "gdrive": "https://drivemcp.googleapis.com/mcp/v1",
    "notion": "https://mcp.notion.com/mcp",
    "github": "https://api.githubcopilot.com/mcp/",
    "slack": "https://mcp.slack.com/mcp",
}

TRUST_WEIGHTS: dict[str, float] = {
    "gdrive": 1.0,
    "notion": 1.0,
    "github": 0.85,
    "slack": 0.85,
    "web": 0.60,
}

SOURCE_LABELS: dict[str, str] = {
    "gdrive": "Google Drive",
    "notion": "Notion",
    "github": "GitHub",
    "slack": "Slack",
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
        # MCP source fetching requires Anthropic's beta MCP client API, unavailable with Groq
        return []

    async def _web_search(self, topic: str) -> list[dict]:
        # Built-in web search requires Anthropic's web_search tool, unavailable with Groq
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
