import re
import urllib.parse
from datetime import datetime, timezone
import httpx

_CURRENT_PATTERNS = [
    r'\b20(2[4-9]|[3-9]\d)\b',
    r'\b(result|results|winner|won|lose|lost|score|scores|standing)\b',
    r'\b(latest|current|today|now|live|recent|news|update|updates)\b',
    r'\b(election|match|game|price|weather|stock|crypto|rate|championship)\b',
    r'\b(died|dead|death|die|alive|obituary|passed away|passed|demise)\b',
    r'\b(born|age|how old|years old|birthday)\b',
    r'\b(married|divorced|arrested|released|appointed|elected|launched)\b',
    r'\b(who is|who was|what happened|when did|where is|is he|is she)\b',
    r'\b(president|prime minister|ceo|chief minister|minister|governor)\b',
]

_STOP_WORDS = {
    'when', 'did', 'does', 'do', 'is', 'was', 'were', 'are', 'who', 'what',
    'where', 'how', 'the', 'a', 'an', 'in', 'on', 'at', 'of', 'to', 'for',
    'with', 'by', 'from', 'and', 'or', 'but', 'not', 'die', 'died', 'born',
    'age', 'alive', 'dead', 'death', 'pass', 'passed', 'away', 'win', 'won',
    'lose', 'result', 'latest', 'current', 'news', 'today', 'happened',
    'election', 'about', 'tell', 'me', 'know', 'show', 'get', 'give',
    'her', 'him', 'his', 'she', 'he', 'they', 'it', 'its', 'this', 'that',
}


def needs_web_search(topic: str) -> bool:
    return any(re.search(p, topic, re.IGNORECASE) for p in _CURRENT_PATTERNS)


def _extract_entity(query: str) -> str:
    """Extract probable entity name from query (handles all-lowercase input)."""
    clean = re.sub(r'[?!.,;:\'"()]', '', query.lower())
    words = [w for w in clean.split() if w not in _STOP_WORDS and len(w) > 1]
    return " ".join(w.title() for w in words) if words else query


async def search_web(query: str) -> str:
    """
    Fetch live data via:
    1. DuckDuckGo Instant Answer API
    2. Wikipedia MediaWiki extracts API (fresher than REST summary API)

    Returns formatted context string. Never raises.
    """
    results: list[str] = []
    encoded_q = urllib.parse.quote_plus(query)
    today = datetime.now(timezone.utc).strftime("%B %d, %Y")

    print(f"[web_search] Query: {query!r}  |  Today: {today}")

    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:

        # ── 1. DuckDuckGo Instant Answer ──────────────────────────────────
        try:
            r = await client.get(
                f"https://api.duckduckgo.com/?q={encoded_q}&format=json&no_redirect=1&no_html=1",
                headers={"User-Agent": "Mozilla/5.0 (compatible; ELIM/1.0)"},
            )
            if r.status_code == 200:
                d = r.json()
                if d.get("Answer"):
                    results.append(f"[Direct Answer] {d['Answer']}")
                    print(f"[web_search] DDG answer: {d['Answer'][:80]}")
                if d.get("AbstractText"):
                    results.append(f"[{d.get('AbstractSource','DDG')}] {d['AbstractText'][:800]}")
                    print(f"[web_search] DDG abstract: {d['AbstractText'][:80]}")
        except Exception as e:
            print(f"[web_search] DDG error: {e}")

        # ── 2. Wikipedia MediaWiki API (extracts — fresher than REST) ─────
        try:
            entity = _extract_entity(query)
            print(f"[web_search] Entity for Wikipedia: {entity!r}")

            # Step A: search for the best matching article title
            r2 = await client.get(
                "https://en.wikipedia.org/w/api.php",
                params={
                    "action": "query",
                    "list": "search",
                    "srsearch": entity,
                    "srlimit": "1",
                    "format": "json",
                },
                headers={"User-Agent": "ELIM/1.0 (educational)"},
            )
            title = None
            if r2.status_code == 200:
                hits = r2.json().get("query", {}).get("search", [])
                if hits:
                    title = hits[0]["title"]
                    print(f"[web_search] Wikipedia article: {title!r}")

            if title:
                # Step B: fetch the full intro section as plain text
                r3 = await client.get(
                    "https://en.wikipedia.org/w/api.php",
                    params={
                        "action": "query",
                        "prop": "extracts",
                        "exintro": "true",      # only intro section
                        "explaintext": "true",  # plain text, no markup
                        "exsentences": "20",    # up to 20 sentences
                        "titles": title,
                        "format": "json",
                        "redirects": "1",
                    },
                    headers={"User-Agent": "ELIM/1.0 (educational)"},
                )
                if r3.status_code == 200:
                    pages = r3.json().get("query", {}).get("pages", {})
                    for page in pages.values():
                        extract = page.get("extract", "")[:1000]
                        if extract:
                            print(f"[web_search] Wikipedia extract (first 120): {extract[:120]}")
                            results.insert(0, f"[Wikipedia: {title}] {extract}")
                            break
        except Exception as e:
            print(f"[web_search] Wikipedia error: {e}")

    print(f"[web_search] Result pieces: {len(results)}")
    if not results:
        print("[web_search] No results fetched — LLM will use training data only")
        return ""

    return (
        f"TODAY'S DATE: {today}\n\n"
        "⚡ LIVE WEB DATA — more current than your training. "
        "OVERRIDE your training knowledge with these facts:\n\n"
        + "\n\n".join(results)
    )
