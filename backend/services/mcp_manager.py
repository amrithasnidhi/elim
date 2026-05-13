import asyncio
import hashlib
import os
from typing import Optional

import httpx
from cryptography.fernet import Fernet, InvalidToken

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

# Mime types Google Drive can export as plain text
_GDRIVE_EXPORTABLE = {
    "application/vnd.google-apps.document": "text/plain",
    "application/vnd.google-apps.spreadsheet": "text/csv",
    "application/vnd.google-apps.presentation": "text/plain",
}

# File extensions worth indexing from GitHub
_GITHUB_TEXT_EXTS = {
    ".md", ".txt", ".rst", ".py", ".js", ".ts", ".jsx", ".tsx",
    ".java", ".go", ".rs", ".c", ".cpp", ".h", ".cs", ".rb",
    ".html", ".css", ".json", ".yaml", ".yml", ".toml", ".sh",
}

_MAX_FILES = 30          # files fetched per source
_MAX_FILE_BYTES = 50_000 # ~50 KB per file


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


# ── Native API fetchers ───────────────────────────────────────────────────────

async def _fetch_gdrive(token: str) -> list[dict]:
    """Fetch text content from Google Drive using the Drive v3 REST API."""
    docs: list[dict] = []
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {"Authorization": f"Bearer {token}"}

            # List files (exclude folders, limit to _MAX_FILES)
            r = await client.get(
                "https://www.googleapis.com/drive/v3/files",
                headers=headers,
                params={
                    "q": "mimeType!='application/vnd.google-apps.folder' and trashed=false",
                    "fields": "files(id,name,mimeType,size)",
                    "pageSize": _MAX_FILES,
                    "orderBy": "modifiedTime desc",
                },
            )
            if r.status_code != 200:
                return []

            files = r.json().get("files", [])
            for f in files:
                fid = f["id"]
                name = f.get("name", fid)
                mime = f.get("mimeType", "")
                try:
                    if mime in _GDRIVE_EXPORTABLE:
                        # Google Workspace docs — export as text
                        export_mime = _GDRIVE_EXPORTABLE[mime]
                        fr = await client.get(
                            f"https://www.googleapis.com/drive/v3/files/{fid}/export",
                            headers=headers,
                            params={"mimeType": export_mime},
                        )
                        if fr.status_code == 200:
                            text = fr.text[:_MAX_FILE_BYTES].strip()
                            if text:
                                docs.append({"text": text, "title": name})
                    elif mime.startswith("text/") or mime == "application/json":
                        # Plain text/code files — download directly
                        size = int(f.get("size", 0))
                        if size > _MAX_FILE_BYTES:
                            continue
                        fr = await client.get(
                            f"https://www.googleapis.com/drive/v3/files/{fid}",
                            headers=headers,
                            params={"alt": "media"},
                        )
                        if fr.status_code == 200:
                            text = fr.text[:_MAX_FILE_BYTES].strip()
                            if text:
                                docs.append({"text": text, "title": name})
                except Exception:
                    continue
    except Exception:
        pass
    return docs


async def _fetch_notion(token: str) -> list[dict]:
    """Fetch page content from Notion using the Notion REST API."""
    docs: list[dict] = []
    headers = {
        "Authorization": f"Bearer {token}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Search all pages
            r = await client.post(
                "https://api.notion.com/v1/search",
                headers=headers,
                json={"filter": {"value": "page", "property": "object"}, "page_size": _MAX_FILES},
            )
            if r.status_code != 200:
                return []

            pages = r.json().get("results", [])
            for page in pages:
                pid = page["id"]
                # Get title from properties
                props = page.get("properties", {})
                title = ""
                for v in props.values():
                    if v.get("type") == "title":
                        parts = v.get("title", [])
                        title = "".join(p.get("plain_text", "") for p in parts)
                        break
                title = title or pid

                try:
                    # Fetch block children (page body)
                    br = await client.get(
                        f"https://api.notion.com/v1/blocks/{pid}/children",
                        headers=headers,
                        params={"page_size": 100},
                    )
                    if br.status_code != 200:
                        continue

                    blocks = br.json().get("results", [])
                    lines: list[str] = []
                    for block in blocks:
                        btype = block.get("type", "")
                        content = block.get(btype, {})
                        rich = content.get("rich_text", [])
                        text = "".join(t.get("plain_text", "") for t in rich)
                        if text.strip():
                            lines.append(text)

                    full_text = "\n".join(lines)[:_MAX_FILE_BYTES]
                    if full_text.strip():
                        docs.append({"text": full_text, "title": title})
                except Exception:
                    continue
    except Exception:
        pass
    return docs


async def _fetch_github(token: str) -> list[dict]:
    """Fetch text files from GitHub repos using the GitHub REST API."""
    docs: list[dict] = []
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
    }
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # List user repos (most recently updated first)
            r = await client.get(
                "https://api.github.com/user/repos",
                headers=headers,
                params={"sort": "updated", "per_page": 10, "affiliation": "owner"},
            )
            if r.status_code != 200:
                return []

            repos = r.json()
            files_fetched = 0

            for repo in repos:
                if files_fetched >= _MAX_FILES:
                    break
                owner = repo["owner"]["login"]
                name = repo["name"]
                default_branch = repo.get("default_branch", "main")

                try:
                    # Get full file tree
                    tr = await client.get(
                        f"https://api.github.com/repos/{owner}/{name}/git/trees/{default_branch}",
                        headers=headers,
                        params={"recursive": "1"},
                    )
                    if tr.status_code != 200:
                        continue

                    tree = tr.json().get("tree", [])
                    for item in tree:
                        if files_fetched >= _MAX_FILES:
                            break
                        if item.get("type") != "blob":
                            continue
                        path = item.get("path", "")
                        size = item.get("size", 0)
                        ext = "." + path.rsplit(".", 1)[-1].lower() if "." in path else ""
                        if ext not in _GITHUB_TEXT_EXTS or size > _MAX_FILE_BYTES:
                            continue

                        try:
                            fr = await client.get(
                                f"https://api.github.com/repos/{owner}/{name}/contents/{path}",
                                headers=headers,
                            )
                            if fr.status_code != 200:
                                continue
                            import base64
                            content_b64 = fr.json().get("content", "")
                            content = base64.b64decode(content_b64.replace("\n", "")).decode("utf-8", errors="ignore")
                            text = content[:_MAX_FILE_BYTES].strip()
                            if text:
                                docs.append({"text": text, "title": f"{name}/{path}"})
                                files_fetched += 1
                        except Exception:
                            continue
                except Exception:
                    continue
    except Exception:
        pass
    return docs


# ── MCPManager ────────────────────────────────────────────────────────────────

class MCPManager:
    """
    Fetches content from connected knowledge sources using their native REST APIs.
    No Anthropic API key required.
    """

    def __init__(self, enabled_sources: list[str], encrypted_tokens: dict[str, str]):
        valid = {"gdrive", "notion", "github", "web"}
        self.sources = [s for s in enabled_sources if s in valid]
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
        """Fetch all indexable content from a source (topic used only for web search)."""
        token = self.tokens.get(source)

        if source == "gdrive":
            if not token:
                return []
            return await _fetch_gdrive(token)

        if source == "notion":
            if not token:
                return []
            return await _fetch_notion(token)

        if source == "github":
            if not token:
                return []
            return await _fetch_github(token)

        if source == "web":
            return await self._web_search(topic)

        return []

    async def _web_search(self, topic: str) -> list[dict]:
        """Delegate to our httpx-based web search (no API key needed)."""
        try:
            from services.web_search import search_web
            text = await search_web(topic)
            if text:
                return [{"text": text, "source": "web", "trust": TRUST_WEIGHTS["web"]}]
        except Exception:
            pass
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
