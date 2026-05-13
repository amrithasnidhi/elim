import os
import httpx
from fastapi import APIRouter, HTTPException, Depends
from dependencies import get_current_user_id

router = APIRouter(prefix="/images", tags=["images"])


async def _search_unsplash(client: httpx.AsyncClient, topic: str, count: int) -> list[dict]:
    key = os.getenv("UNSPLASH_ACCESS_KEY", "")
    if not key:
        return []
    r = await client.get(
        "https://api.unsplash.com/search/photos",
        headers={"Authorization": f"Client-ID {key}"},
        params={"query": topic, "per_page": count, "orientation": "landscape"},
    )
    if r.status_code != 200:
        return []
    items = r.json().get("results", [])
    images = []
    for item in items:
        urls = item.get("urls", {})
        user = item.get("user", {})
        links = item.get("links", {})
        images.append({
            "url":        urls.get("regular", urls.get("full", "")),
            "thumbnail":  urls.get("small", urls.get("thumb", "")),
            "title":      item.get("alt_description") or item.get("description") or topic,
            "source":     user.get("name", "Unsplash"),
            "source_url": links.get("html", "https://unsplash.com"),
        })
    return images


async def _search_pexels(client: httpx.AsyncClient, topic: str, count: int) -> list[dict]:
    key = os.getenv("PEXELS_API_KEY", "")
    if not key:
        return []
    r = await client.get(
        "https://api.pexels.com/v1/search",
        headers={"Authorization": key},
        params={"query": topic, "per_page": count, "orientation": "landscape"},
    )
    if r.status_code != 200:
        return []
    items = r.json().get("photos", [])
    images = []
    for item in items:
        src = item.get("src", {})
        images.append({
            "url":        src.get("large", src.get("original", "")),
            "thumbnail":  src.get("medium", src.get("small", "")),
            "title":      item.get("alt", topic),
            "source":     item.get("photographer", "Pexels"),
            "source_url": item.get("url", "https://pexels.com"),
        })
    return images


async def _search_pixabay(client: httpx.AsyncClient, topic: str, count: int) -> list[dict]:
    key = os.getenv("PIXABAY_API_KEY", "")
    if not key:
        return []
    r = await client.get(
        "https://pixabay.com/api/",
        params={
            "key": key,
            "q": topic,
            "per_page": count,
            "image_type": "photo",
            "orientation": "horizontal",
            "safesearch": "true",
        },
    )
    if r.status_code != 200:
        return []
    items = r.json().get("hits", [])
    images = []
    for item in items:
        images.append({
            "url":        item.get("largeImageURL", item.get("webformatURL", "")),
            "thumbnail":  item.get("webformatURL", ""),
            "title":      " · ".join(item.get("tags", "").split(",")[:3]).title() or topic,
            "source":     item.get("user", "Pixabay"),
            "source_url": item.get("pageURL", "https://pixabay.com"),
        })
    return images


async def _search_brave(client: httpx.AsyncClient, topic: str, count: int) -> list[dict]:
    key = os.getenv("BRAVE_SEARCH_API_KEY", "")
    if not key:
        return []
    r = await client.get(
        "https://api.search.brave.com/res/v1/images/search",
        headers={
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": key,
        },
        params={"q": topic, "count": count, "safesearch": "strict"},
    )
    if r.status_code != 200:
        return []
    items = r.json().get("results", [])
    images = []
    for item in items:
        props = item.get("properties", {})
        thumb = item.get("thumbnail", {})
        url = props.get("url") or item.get("url", "")
        thumbnail = thumb.get("src", url)
        if not url or not thumbnail:
            continue
        images.append({
            "url":        url,
            "thumbnail":  thumbnail,
            "title":      item.get("title", ""),
            "source":     item.get("source", ""),
            "source_url": item.get("url", ""),
        })
    return images


# Provider priority — first one that returns results wins
_PROVIDERS = [_search_unsplash, _search_pexels, _search_pixabay, _search_brave]


@router.get("/search")
async def search_images(
    topic: str,
    count: int = 4,
    user_id: str = Depends(get_current_user_id),
):
    count = max(1, min(count, 8))

    configured = any(
        os.getenv(k)
        for k in ("UNSPLASH_ACCESS_KEY", "PEXELS_API_KEY", "PIXABAY_API_KEY", "BRAVE_SEARCH_API_KEY")
    )
    if not configured:
        return {"images": [], "topic": topic, "error": "no_image_api_key_configured"}

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            for provider in _PROVIDERS:
                try:
                    images = await provider(client, topic, count)
                    if images:
                        return {"images": images, "topic": topic}
                except Exception:
                    continue
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Image search failed: {e}")

    return {"images": [], "topic": topic}
