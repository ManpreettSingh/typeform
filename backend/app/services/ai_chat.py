"""Typeform AI chat: one turn of the conversation.

The model sees the form as it is *right now* (the proposal the creator is reviewing, or the saved form), the conversation and
the creator's memory, and answers with a reply plus, when something should change, the whole new form in a flat shape
(`ai_form`). The server turns that into a validated proposal and a diff against the saved form. Nothing is saved here:
saving is `ai_apply`, after the creator presses "Apply changes to form".
"""

import json
import logging
from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.models import AiMemory, QuestionType
from app.schemas.form import FormCreate
from app.services import ai_client, ai_form
from app.services import forms as form_service
from app.services.ai_schemas import MEMORY_MAX, ChatIn, ChatOut, Proposal, ProposalEnding, ProposalWelcome

logger = logging.getLogger(__name__)

CREATABLE_TYPES = ", ".join(sorted(t.value for t in ai_form.CREATABLE))
ALL_TYPES = [t.value for t in QuestionType]

SYSTEM = f"""You are Typeform AI, the assistant inside a form builder. You help people create and edit forms by chatting.

HOW YOU ANSWER
- Always give a short, friendly reply in the user's language: what you did, or the answer to their question.
- When the user wants the form created or changed, also return the COMPLETE new form in "form": every question to keep, in
  order, plus the new ones. Keep each existing question's "id" unchanged. Questions you leave out are deleted, so never drop
  one unless asked. New questions have no id. Endings work the same way.
- Fill EVERY field of every question and ending. For a question you keep, copy its current values and change only what was
  asked. Put null in fields that don't apply (options only for multiple_choice, dropdown and ranking; allow_multiple only for
  multiple_choice; rating_max and rating_shape only for rating). A new question or ending has id null.
- When the user only asks a question, wants advice, or asks for something you cannot do, set "form" to null and explain.
- Keep the existing wording, order and settings unless asked to change them. Never invent answers for the user.

WHAT YOU CAN DO
Create, edit, reorder and delete questions; change the form title, the welcome line and the ending screens; suggest improvements.

WHAT YOU CANNOT DO YET (say it is "not supported yet" in one friendly sentence and offer what you can do instead)
Design changes (colors, fonts, themes, images, layout), branching or logic rules, scoring or quiz endings, payments, file uploads,
translations, integrations. Groups of questions are never changed by you; leave group items exactly as they are.

QUESTION TYPES you may add: {CREATABLE_TYPES}.
- Ask one thing per question, in the order a person would naturally answer; conversational titles, under 120 characters.
- multiple_choice, dropdown and ranking need "options" (labels only, 2 to 8, ranking at least 2); set allow_multiple true when
  several answers can apply ("choose several", "select all that apply"). checkbox is ONE tick box with a label (like
  "I agree"), never a list to pick from. yes_no, short_text, long_text, email, number, phone_number, website, date, legal, checkbox,
  statement, contact_info, address, opinion_scale and nps need no options.
- rating: rating_max 3-10 (usually 5) and rating_shape star, heart or number.
- Use email for email addresses, phone_number for phones, number for amounts, date for dates, statement for text without an answer.
- "title" is the form's name; "description" is one welcoming sentence shown before the first question (or null).
- Endings have a title and a short message."""

def _nullable(schema: dict[str, Any]) -> dict[str, Any]:
    return {**schema, "nullable": True}


_QUESTION_PROPERTIES: dict[str, Any] = {
    "id": _nullable({"type": "INTEGER"}),
    "type": {"type": "STRING", "enum": ALL_TYPES},
    "title": {"type": "STRING"},
    "description": _nullable({"type": "STRING"}),
    "required": {"type": "BOOLEAN"},
    "options": _nullable({"type": "ARRAY", "items": {"type": "STRING"}}),
    "allow_multiple": _nullable({"type": "BOOLEAN"}),
    "rating_max": _nullable({"type": "INTEGER"}),
    "rating_shape": _nullable({"type": "STRING", "enum": list(ai_form.RATING_SHAPES)}),
}
_ENDING_PROPERTIES: dict[str, Any] = {
    "id": _nullable({"type": "INTEGER"}),
    "title": {"type": "STRING"},
    "message": {"type": "STRING"},
}
# Every key is required (null where it doesn't apply): a key the model may omit is a change it can silently drop.
_FORM_PROPERTIES: dict[str, Any] = {
    "title": {"type": "STRING"},
    "description": _nullable({"type": "STRING"}),
    "questions": {
        "type": "ARRAY",
        "items": {"type": "OBJECT", "properties": _QUESTION_PROPERTIES, "required": list(_QUESTION_PROPERTIES)},
    },
    "endings": {
        "type": "ARRAY",
        "items": {"type": "OBJECT", "properties": _ENDING_PROPERTIES, "required": list(_ENDING_PROPERTIES)},
    },
}
RESPONSE_SCHEMA: dict[str, Any] = {
    "type": "OBJECT",
    "properties": {
        "reply": {"type": "STRING"},
        "form": _nullable({"type": "OBJECT", "properties": _FORM_PROPERTIES, "required": list(_FORM_PROPERTIES)}),
    },
    "required": ["reply", "form"],
}


# ---- memory -------------------------------------------------------------------------------------------------------


def get_memory(db: Session) -> str:
    row = db.get(AiMemory, 1)
    return row.content if row else ""


def set_memory(db: Session, content: str) -> str:
    row = db.get(AiMemory, 1)
    if row is None:
        row = AiMemory(id=1, content=content)
        db.add(row)
    else:
        row.content = content
    db.commit()
    return row.content


# ---- chat ---------------------------------------------------------------------------------------------------------


def empty_proposal() -> Proposal:
    """The starting point when the AI drafts a form that doesn't exist yet."""
    return Proposal(
        welcome=ProposalWelcome(title=FormCreate().title),
        questions=[],
        endings=[ProposalEnding(id=None, title="Thanks for completing this form", message="Your response has been recorded.")],
    )


def _system(base: Proposal, memory: str) -> str:
    parts = [SYSTEM, "CURRENT FORM (JSON):\n" + json.dumps(ai_form.proposal_to_ai(base), ensure_ascii=False)]
    if memory.strip():
        parts.append("ABOUT THE CREATOR (context, tone and audience; never repeat it back):\n" + memory.strip()[:MEMORY_MAX])
    return "\n\n".join(parts)


def chat(db: Session, data: ChatIn) -> ChatOut:
    if data.form_id is not None:
        saved = ai_form.form_to_proposal(form_service.get_form(db, data.form_id))
    else:
        saved = empty_proposal()
    base = data.draft or saved
    memory = data.memory if data.memory is not None else get_memory(db)

    contents = [{"role": "user" if m.role == "user" else "model", "parts": [{"text": m.content}]} for m in data.messages]
    answer = ai_client.generate_json(_system(base, memory), contents, RESPONSE_SCHEMA)
    if not isinstance(answer, dict):
        answer = {}

    reply = answer.get("reply") if isinstance(answer.get("reply"), str) else ""
    reply = reply.strip() or "Done."
    raw_form = answer.get("form")
    if not isinstance(raw_form, dict):
        return ChatOut(reply=reply, proposal=None, diff=None)

    try:
        proposal, notes = ai_form.ai_to_proposal(raw_form, base)
    except (ValueError, ValidationError) as exc:
        logger.warning("Unusable form from Gemini: %s", exc)
        return ChatOut(reply=f"{reply}\n\nI couldn't turn that into a valid form. Try rephrasing your request.", proposal=None, diff=None)
    if notes:
        reply = f"{reply}\n\n{' '.join(notes)}"
    if proposal.model_dump() == base.model_dump():
        return ChatOut(reply=reply, proposal=None, diff=None)  # nothing changed this turn
    return ChatOut(reply=reply, proposal=proposal, diff=ai_form.diff(saved, proposal))
