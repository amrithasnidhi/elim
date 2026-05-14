from fastapi import APIRouter, Depends

from dependencies import get_current_user_id
from services.metaphor_fingerprint import (
    DOMAIN_DESCRIPTIONS,
    DOMAINS,
    extract_domain,
    get_fingerprint_profile,
)

router = APIRouter(
    prefix="/metaphor",
    tags=["metaphor"],
    responses={401: {"description": "Not authenticated"}},
)


@router.get("/profile")
async def get_metaphor_profile(user_id: str = Depends(get_current_user_id)):
    """Returns the user's metaphor domain fingerprint profile for the Thinking Style Card."""
    return await get_fingerprint_profile(user_id)


@router.get("/domains")
async def list_domains():
    """Returns all available metaphor domains with descriptions."""
    return [{"domain": d, "description": DOMAIN_DESCRIPTIONS[d]} for d in DOMAINS]


@router.post("/classify")
async def classify_text(body: dict, user_id: str = Depends(get_current_user_id)):
    """Manually classify the domain of a text snippet. Used for testing/debugging."""
    text = body.get("text", "")
    if not text:
        return {"primary_domain": "none"}
    return await extract_domain(text)
