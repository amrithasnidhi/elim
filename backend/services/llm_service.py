"""
Unified LLM service with fallback logic:
- Primary: Anthropic Claude (if ANTHROPIC_API_KEY is set)
- Fallback: Groq (if GROQ_API_KEY is set)
- Error if neither available
"""

import os
from typing import Optional

# Lazy imports
_anthropic = None
_groq = None


def _get_anthropic():
    global _anthropic
    if _anthropic is None:
        try:
            import anthropic
            _anthropic = anthropic
        except ImportError:
            pass
    return _anthropic


def _get_groq():
    global _groq
    if _groq is None:
        try:
            import groq
            _groq = groq
        except ImportError:
            pass
    return _groq


# Model mappings: Anthropic -> Groq equivalents
GROQ_MODEL_MAP = {
    "claude-sonnet-4-5": "llama-3.3-70b-versatile",
    "claude-sonnet-4-20250514": "llama-3.3-70b-versatile",
    "claude-haiku-4-5-20251001": "llama-3.1-8b-instant",
    "claude-3-haiku-20240307": "llama-3.1-8b-instant",
}


class LLMResponse:
    """Unified response object for LLM calls."""
    def __init__(self, text: str, model: str, provider: str):
        self.text = text
        self.model = model
        self.provider = provider


async def call_llm(
    messages: list[dict],
    model: str = "claude-sonnet-4-5",
    max_tokens: int = 1024,
    system: Optional[str] = None,
) -> LLMResponse:
    """
    Call LLM with automatic fallback.

    Args:
        messages: List of {"role": "user"|"assistant", "content": str}
        model: Anthropic model name (will be mapped to Groq equivalent if falling back)
        max_tokens: Maximum response tokens
        system: Optional system prompt

    Returns:
        LLMResponse with text, model used, and provider

    Raises:
        RuntimeError if no LLM provider is available
    """
    anthropic_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    groq_key = os.getenv("GROQ_API_KEY", "").strip()

    # Try Anthropic first
    if anthropic_key:
        anthropic_mod = _get_anthropic()
        if anthropic_mod:
            try:
                client = anthropic_mod.AsyncAnthropic(api_key=anthropic_key)
                kwargs = {
                    "model": model,
                    "max_tokens": max_tokens,
                    "messages": messages,
                }
                if system:
                    kwargs["system"] = system

                response = await client.messages.create(**kwargs)
                return LLMResponse(
                    text=response.content[0].text,
                    model=model,
                    provider="anthropic",
                )
            except Exception as e:
                # Log and fall through to Groq
                if not groq_key:
                    raise RuntimeError(f"Anthropic API error and no Groq fallback: {e}")

    # Fallback to Groq
    if groq_key:
        groq_mod = _get_groq()
        if groq_mod:
            try:
                groq_model = GROQ_MODEL_MAP.get(model, "llama-3.3-70b-versatile")
                client = groq_mod.AsyncGroq(api_key=groq_key)

                # Convert messages format for Groq (OpenAI-compatible)
                groq_messages = []
                if system:
                    groq_messages.append({"role": "system", "content": system})
                groq_messages.extend(messages)

                response = await client.chat.completions.create(
                    model=groq_model,
                    max_tokens=max_tokens,
                    messages=groq_messages,
                )
                return LLMResponse(
                    text=response.choices[0].message.content,
                    model=groq_model,
                    provider="groq",
                )
            except Exception as e:
                raise RuntimeError(f"Groq API error: {e}")

    raise RuntimeError("No LLM provider configured. Set ANTHROPIC_API_KEY or GROQ_API_KEY.")


async def call_llm_simple(
    prompt: str,
    model: str = "claude-sonnet-4-5",
    max_tokens: int = 1024,
    system: Optional[str] = None,
) -> str:
    """Simplified interface - takes a prompt string, returns response text."""
    response = await call_llm(
        messages=[{"role": "user", "content": prompt}],
        model=model,
        max_tokens=max_tokens,
        system=system,
    )
    return response.text


def get_available_provider() -> Optional[str]:
    """Check which LLM provider is available."""
    if os.getenv("ANTHROPIC_API_KEY", "").strip():
        return "anthropic"
    if os.getenv("GROQ_API_KEY", "").strip():
        return "groq"
    return None


def is_llm_available() -> bool:
    """Check if any LLM provider is configured."""
    return get_available_provider() is not None
