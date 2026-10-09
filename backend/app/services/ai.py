"""Typeform AI ("Create with AI"): drafts questions from a prompt with Gemini.

Gemini returns structured JSON (a response schema), which is mapped onto the normal question types
and stored through the regular question service, so AI questions follow every rule hand-made ones do.
"""

import json
import logging
from typing import Any, Literal

import httpx
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import BadGatewayError, ServiceUnavailableError
from app.models import Form, QuestionType
from app.question_types import SPECS
from app.schemas.form import FormCreate
from app.schemas.properties import new_option_id
from app.schemas.question import QuestionCreate
from app.services import forms as form_service
from app.services import questions as question_service

logger = logging.getLogger(__name__)

GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MAX_QUESTIONS = 15
DEFAULT_TITLE = FormCreate().title
# Only types that take an answer: the registry decides, so a new type reaches the AI by being registered.
ANSWERABLE_TYPES = [t.value for t, spec in SPECS.items() if spec.answerable]

INSTRUCTIONS = f"""You design online forms for Typeform. Turn the creator's request into a short, friendly form.
Rules:
- Use only these question types: {", ".join(ANSWERABLE_TYPES)}.
- Ask one thing per question, in the order a person would naturally answer. 3 to 10 questions unless asked otherwise.
- Titles are conversational and end with "?" when they are questions. Keep them under 120 characters.
- multiple_choice and dropdown need 2 to 8 options; set allow_multiple when several can apply.
- rating is for scores (rating_max 3-10, usually 5 or 10; shape star, heart or number).
- Use email for email addresses and number for numeric amounts.
- title is a short name for the whole form; description is one welcoming sentence shown before the first question.
- If the request lists questions, keep them (and their order) and pick the best type for each.
Answer in the language of the request."""

# Gemini's OpenAPI-style schema for structured output.
RESPONSE_SCHEMA = {
    "type": "OBJECT",
    "properties": {
        "title": {"type": "STRING"},
        "description": {"type": "STRING"},
        "questions": {
            "type": "ARRAY",
            "items": {
                "type": "OBJECT",
                "properties": {
                    "type": {"type": "STRING", "enum": ANSWERABLE_TYPES},
                    "title": {"type": "STRING"},
                    "description": {"type": "STRING"},
                    "required": {"type": "BOOLEAN"},
                    "options": {"type": "ARRAY", "items": {"type": "STRING"}},
                    "allow_multiple": {"type": "BOOLEAN"},
                    "rating_max": {"type": "INTEGER"},
                    "rating_shape": {"type": "STRING", "enum": ["star", "heart", "number"]},
                },
                "required": ["type", "title"],
            },
        },
    },
    "required": ["title", "questions"],
}


class GeneratedQuestion(BaseModel):
    type: QuestionType
    title: str = Field(max_length=1000)
    description: str | None = Field(default=None, max_length=2000)
    required: bool = False
    options: list[str] = []
    allow_multiple: bool = False
    rating_max: int | None = None
    rating_shape: Literal["star", "heart", "number"] | None = None


class GeneratedForm(BaseModel):
    title: str = ""
    description: str | None = None
    questions: list[GeneratedQuestion]


def _properties(q: GeneratedQuestion) -> dict[str, Any] | None:
    if q.type in (QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN):
        labels = [label.strip()[:500] for label in q.options if label.strip()][:50] or ["Yes", "No"]
        options = [{"id": new_option_id(), "label": label} for label in labels]
        if q.type == QuestionType.DROPDOWN:
            return {"options": options}
        return {"options": options, "allow_multiple": q.allow_multiple, "allow_other": False}
    if q.type == QuestionType.RATING:
        return {"max": min(max(q.rating_max or 5, 3), 10), "shape": q.rating_shape or "star"}
    return None  # type defaults


def _call_gemini(prompt: str) -> GeneratedForm:
    settings = get_settings()
    if not settings.gemini_api_key:
        raise ServiceUnavailableError("Typeform AI isn't set up yet. Add GEMINI_API_KEY to backend/.env and restart the server.")

    body = {
        "systemInstruction": {"parts": [{"text": INSTRUCTIONS}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "responseSchema": RESPONSE_SCHEMA,
            "temperature": 0.7,
        },
    }
    try:
        res = httpx.post(
            GEMINI_URL.format(model=settings.gemini_model),
            headers={"x-goog-api-key": settings.gemini_api_key},
            json=body,
            timeout=60,
        )
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
        raise BadGatewayError("Typeform AI couldn't create questions right now. Try again.")

    try:
        parts = res.json()["candidates"][0]["content"]["parts"]
        generated = GeneratedForm.model_validate(json.loads("".join(p.get("text", "") for p in parts)))
    except (KeyError, IndexError, ValueError, ValidationError) as exc:
        logger.warning("Unusable Gemini answer: %s", res.text[:500])
        raise BadGatewayError("Typeform AI's answer didn't make sense. Try rephrasing your request.") from exc
    if not generated.questions:
        raise BadGatewayError("Typeform AI didn't come up with any questions. Try describing your form in more detail.")
    return generated


def generate_into(db: Session, form: Form, prompt: str) -> Form:
    """Appends AI-drafted questions to `form`; names it and adds a welcome line if it has none yet."""
    generated = _call_gemini(prompt)

    if form.title == DEFAULT_TITLE and generated.title.strip():
        form.title = generated.title.strip()[:200]
    if not form.description and generated.description and generated.description.strip():
        form.description = generated.description.strip()[:2000]
    db.commit()

    for q in generated.questions[:MAX_QUESTIONS]:
        question_service.create_question(
            db,
            form,
            QuestionCreate(
                type=q.type,
                title=q.title.strip(),
                description=(q.description or "").strip() or None,
                required=q.required,
                properties=_properties(q),
            ),
        )
    db.refresh(form)
    return form


def create_form_with_ai(db: Session, prompt: str) -> Form:
    """"Ask Typeform AI" from the workspace: a new form built from the prompt. Nothing is kept if AI fails."""
    form = form_service.create_form(db, FormCreate())
    try:
        return generate_into(db, form, prompt)
    except Exception:
        form_service.delete_form(db, form)
        raise
