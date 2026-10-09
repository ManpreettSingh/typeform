"""The one place that talks to Gemini: builds the request, maps every failure to a friendly 502/503 and returns parsed JSON.

The model id comes from settings (GEMINI_MODEL); the key never leaves the server. Tests replace `httpx.post`.
"""

import json
import logging
import re
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.errors import BadGatewayError, ServiceUnavailableError

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
# A chat turn must feel quick; a stuck call is better reported than waited for.
TIMEOUT_SECONDS = 30
_FENCE = re.compile(r"^\s*```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL)


def generate_json(
    system: str,
    contents: list[dict[str, Any]],
    schema: dict[str, Any],
    *,
    temperature: float = 0.4,
    timeout: float = TIMEOUT_SECONDS,
) -> Any:
    """Asks Gemini for a JSON answer shaped by `schema` (Gemini's OpenAPI-style response schema) and returns it parsed."""
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ServiceUnavailableError("Typeform AI isn't set up yet. Add GEMINI_API_KEY to backend/.env and restart the server.")

    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": contents,
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": schema,
            "temperature": temperature,
        },
    }
    try:
        res = httpx.post(
            GEMINI_URL.format(model=settings.gemini_model),
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=body,
            timeout=min(timeout, TIMEOUT_SECONDS),
        )
    except httpx.TimeoutException as exc:
        logger.warning("Gemini request timed out: %s", exc)
        raise BadGatewayError("Typeform AI took too long to answer. Try again.") from exc
    except httpx.HTTPError as exc:
        logger.warning("Gemini request failed: %s", exc)
        raise BadGatewayError("Couldn't reach Typeform AI. Check your connection and try again.") from exc

    if res.status_code != 200:
        logger.warning("Gemini answered %s: %s", res.status_code, res.text[:500])
        if res.status_code in (401, 403) or "API_KEY" in res.text:
            raise BadGatewayError("Gemini rejected the API key. Check GEMINI_API_KEY in backend/.env.")
        if res.status_code == 429:
            raise BadGatewayError("Typeform AI is busy right now (rate limit). Try again in a minute.")
        if res.status_code == 404:
            raise BadGatewayError(f"Gemini doesn't know the model {settings.gemini_model!r}. Check GEMINI_MODEL in backend/.env.")
        raise BadGatewayError("Typeform AI couldn't answer right now. Try again.")

    try:
        parts = res.json()["candidates"][0]["content"]["parts"]
        text = "".join(p.get("text", "") for p in parts)
        fenced = _FENCE.match(text)
        return json.loads(fenced.group(1) if fenced else text)
    except (KeyError, IndexError, TypeError, ValueError, AttributeError) as exc:
        logger.warning("Unusable Gemini answer: %s", res.text[:500])
        raise BadGatewayError("Typeform AI's answer didn't make sense. Try rephrasing your request.") from exc
