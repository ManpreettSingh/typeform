"""The AI chat's conversion layer.

Three shapes meet here:
- the **saved form** (ORM rows),
- the **proposal** (`ai_schemas.Proposal`): the whole form as it would look after a change, with full, validated question
  properties. The review view shows it and Apply saves it,
- the **model view**: a small flat JSON (type, title, options…) that Gemini reads and writes. Gemini never sees or invents
  option ids or property internals: unchanged questions keep every stored property, edited choices keep the ids of the labels
  that survive (so answers and rules still point at them).

`ai_to_proposal` never trusts the model: every item is validated like a manual edit, bad items are dropped with a note.
"""

from __future__ import annotations

import copy
from typing import Any

from pydantic import BaseModel, ConfigDict, ValidationError

from app.models import Form
from app.models.enums import QuestionType
from app.schemas.properties import default_properties, new_option_id, validate_properties
from app.schemas.question import QUESTION_DESCRIPTION_MAX, QUESTION_TITLE_MAX
from app.services.ai_schemas import (
    MAX_ENDINGS,
    Diff,
    EndingChange,
    EndingsDiff,
    EndingSummary,
    Proposal,
    ProposalEnding,
    ProposalQuestion,
    ProposalWelcome,
    QuestionChange,
    QuestionSummary,
)

MAX_QUESTIONS = 50
CHOICE_TYPES = {QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN, QuestionType.RANKING}
# Types the AI may add. The rest (groups, pictures, grids) are only passed through when they already exist.
CREATABLE = {t for t in QuestionType if t not in (QuestionType.GROUP, QuestionType.PICTURE_CHOICE, QuestionType.MATRIX)}
RATING_SHAPES = ("star", "heart", "number")
OPTION_MAX = 50


class _AiQuestion(BaseModel):
    model_config = ConfigDict(extra="ignore")

    id: int | None = None
    type: str
    title: str = ""
    description: str | None = None
    required: bool = False
    options: list[str] | None = None
    allow_multiple: bool | None = None
    rating_max: int | None = None
    rating_shape: str | None = None


# ---- saved form -> proposal -> model view -------------------------------------------------------------------------


def form_to_proposal(form: Form) -> Proposal:
    welcome = form.welcome or {}
    return Proposal(
        welcome=ProposalWelcome(
            title=form.title,
            description=form.description,
            button_text=welcome.get("button_text", "Start"),
            show_time_to_complete=bool(welcome.get("show_time_to_complete")),
            show_submission_count=bool(welcome.get("show_submission_count")),
        ),
        questions=[
            ProposalQuestion(
                id=q.id,
                type=QuestionType(q.type),
                title=q.title,
                description=q.description,
                required=q.required,
                properties=copy.deepcopy(q.properties),
                group_id=q.group_id,
            )
            for q in sorted(form.questions, key=lambda q: q.position)
        ],
        endings=[
            ProposalEnding(id=e.id, title=e.title, message=e.message, button_text=e.button_text, button_url=e.button_url)
            for e in sorted(form.endings, key=lambda e: e.position)
        ],
    )


def proposal_to_ai(p: Proposal) -> dict[str, Any]:
    questions = []
    for q in p.questions:
        item: dict[str, Any] = {
            "id": q.id,
            "type": q.type.value,
            "title": q.title,
            "description": q.description,
            "required": q.required,
        }
        if q.type in CHOICE_TYPES:
            item["options"] = [o["label"] for o in q.properties.get("options", [])]
        if q.type == QuestionType.MULTIPLE_CHOICE:
            item["allow_multiple"] = bool(q.properties.get("allow_multiple"))
        if q.type == QuestionType.RATING:
            item["rating_max"] = q.properties.get("max", 5)
            item["rating_shape"] = q.properties.get("shape", "star")
        questions.append(item)
    return {
        "title": p.welcome.title,
        "description": p.welcome.description,
        "questions": questions,
        "endings": [{"id": e.id, "title": e.title, "message": e.message} for e in p.endings],
    }


# ---- model output -> proposal -------------------------------------------------------------------------------------


def _labels(options: list[str] | None) -> list[str]:
    seen: set[str] = set()
    labels = []
    for raw in options or []:
        label = raw.strip()[:500]
        if label and label.lower() not in seen:
            seen.add(label.lower())
            labels.append(label)
    return labels[:OPTION_MAX]


def _rating_max(value: int | None) -> int:
    return min(max(value or 5, 3), 10)


def _new_properties(qtype: QuestionType, item: _AiQuestion) -> dict[str, Any]:
    if qtype in CHOICE_TYPES:
        labels = _labels(item.options)
        if len(labels) < (2 if qtype == QuestionType.RANKING else 1):
            labels = ["Yes", "No"]
        props: dict[str, Any] = {"options": [{"id": new_option_id(), "label": label} for label in labels]}
        if qtype == QuestionType.MULTIPLE_CHOICE:
            props["allow_multiple"] = bool(item.allow_multiple)
        return validate_properties(qtype, props)
    if qtype == QuestionType.RATING:
        shape = item.rating_shape if item.rating_shape in RATING_SHAPES else "star"
        return validate_properties(qtype, {"max": _rating_max(item.rating_max), "shape": shape})
    return default_properties(qtype)


def _merged_properties(base: ProposalQuestion, item: _AiQuestion) -> dict[str, Any]:
    """The stored properties with only what the model's flat view can express changed."""
    props = copy.deepcopy(base.properties)
    if base.type in CHOICE_TYPES and item.options is not None:
        labels = _labels(item.options)
        if len(labels) >= (2 if base.type == QuestionType.RANKING else 1):
            existing = {o["label"].strip().lower(): o for o in props.get("options", [])}
            props["options"] = [existing.pop(label.lower(), None) or {"id": new_option_id(), "label": label} for label in labels]
    if base.type == QuestionType.MULTIPLE_CHOICE and item.allow_multiple is not None:
        props["allow_multiple"] = item.allow_multiple
    if base.type == QuestionType.RATING:
        if item.rating_max is not None:
            props["max"] = _rating_max(item.rating_max)
        if item.rating_shape in RATING_SHAPES:
            props["shape"] = item.rating_shape
    if props == base.properties:
        return base.properties  # untouched: already valid, keep it byte for byte
    return validate_properties(base.type, props)


def _clean(text: str | None, limit: int) -> str | None:
    return (text or "").strip()[:limit] or None


def _group_neighbours(out: list[ProposalQuestion], base_ids: set[int]) -> None:
    """A new question between two children of one group (or right under its header) joins that group."""
    for i, q in enumerate(out):
        if q.id is not None and q.id in base_ids:
            continue
        prev = out[i - 1] if i > 0 else None
        nxt = out[i + 1] if i + 1 < len(out) else None
        if prev is None or nxt is None or nxt.type == QuestionType.GROUP:
            continue
        gid = prev.id if prev.type == QuestionType.GROUP else prev.group_id
        if gid is not None and nxt.group_id == gid:
            q.group_id = gid


def _keep_groups_together(out: list[ProposalQuestion]) -> list[ProposalQuestion]:
    """Children always sit directly under their header, in the order the model gave them."""
    children: dict[int, list[ProposalQuestion]] = {}
    for q in out:
        if q.type != QuestionType.GROUP and q.group_id is not None:
            children.setdefault(q.group_id, []).append(q)
    headers = {q.id for q in out if q.type == QuestionType.GROUP}
    result: list[ProposalQuestion] = []
    for q in out:
        if q.type == QuestionType.GROUP:
            result.append(q)
            result.extend(children.get(q.id, []))
        elif q.group_id is None or q.group_id not in headers:
            q.group_id = None  # its header is gone: it stands alone
            result.append(q)
    return result


def ai_to_proposal(data: Any, base: Proposal) -> tuple[Proposal, list[str]]:
    """Turns the model's flat JSON into a validated Proposal built on `base` (what the creator is looking at now)."""
    if not isinstance(data, dict):
        raise ValueError("The AI's form must be an object")
    notes: list[str] = []
    base_q = {q.id: q for q in base.questions if q.id is not None}
    out: list[ProposalQuestion] = []
    seen_ids: set[int] = set()

    raw_questions = data.get("questions") if isinstance(data.get("questions"), list) else []
    if len(raw_questions) > MAX_QUESTIONS:
        notes.append(f"I kept the first {MAX_QUESTIONS} questions.")
        raw_questions = raw_questions[:MAX_QUESTIONS]

    for raw in raw_questions:
        try:
            item = _AiQuestion.model_validate(raw)
            qtype = QuestionType(item.type)
        except (ValidationError, ValueError):
            notes.append(f"I skipped a question I couldn't understand ({_describe(raw)}).")
            continue

        old = base_q.get(item.id) if item.id is not None and item.id not in seen_ids else None
        if old is not None and old.type != qtype:
            old = None  # a different type is a different question: the old one goes, a new one comes
        if old is not None and qtype == QuestionType.GROUP:
            out.append(old.model_copy(deep=True))  # groups are never changed by the AI
            seen_ids.add(old.id)
            continue
        if old is None and qtype not in CREATABLE:
            notes.append(f"I can't add {qtype.value.replace('_', ' ')} questions yet, so I skipped “{(item.title or '').strip()[:60]}”.")
            continue

        answerable = qtype not in (QuestionType.STATEMENT, QuestionType.GROUP)
        try:
            props = _merged_properties(old, item) if old is not None else _new_properties(qtype, item)
        except ValidationError:
            if old is None:
                notes.append(f"I skipped “{(item.title or '').strip()[:60]}” because its settings weren't valid.")
                continue
            props = old.properties
        out.append(
            ProposalQuestion(
                id=old.id if old is not None else None,
                type=qtype,
                title=(item.title or "").strip()[:QUESTION_TITLE_MAX],
                description=_clean(item.description, QUESTION_DESCRIPTION_MAX),
                required=bool(item.required) and answerable,
                properties=props,
                group_id=old.group_id if old is not None else None,
            )
        )
        if old is not None:
            seen_ids.add(old.id)

    # A group the model left out comes back right before its first surviving child.
    for g in (q for q in base.questions if q.type == QuestionType.GROUP and q.id not in seen_ids):
        index = next((i for i, q in enumerate(out) if q.id is not None and q.group_id == g.id), None)
        if index is not None:
            out.insert(index, g.model_copy(deep=True))

    _group_neighbours(out, {i for i in base_q})
    out = _keep_groups_together(out)

    welcome = base.welcome.model_copy(update={"title": _clean(data.get("title"), 200) or base.welcome.title})
    if "description" in data:
        welcome.description = _clean(data.get("description"), 2000)

    base_end = {e.id: e for e in base.endings if e.id is not None}
    endings: list[ProposalEnding] = []
    for raw in (data.get("endings") if isinstance(data.get("endings"), list) else [])[:MAX_ENDINGS]:
        if not isinstance(raw, dict):
            continue
        old_end = base_end.get(raw.get("id")) if isinstance(raw.get("id"), int) else None
        fields = {
            "title": _clean(raw.get("title"), 200) or (old_end.title if old_end else "Thanks for completing this form"),
            "message": _clean(raw.get("message"), 1000) or (old_end.message if old_end else "Your response has been recorded."),
        }
        endings.append(
            old_end.model_copy(update=fields) if old_end is not None else ProposalEnding(id=None, **fields)
        )
    if not endings:
        endings = [e.model_copy(deep=True) for e in base.endings]

    return Proposal(welcome=welcome, questions=out, endings=endings), notes


def _describe(raw: Any) -> str:
    if isinstance(raw, dict):
        return str(raw.get("title") or raw.get("type") or "?")[:60]
    return "?"


# ---- diff ---------------------------------------------------------------------------------------------------------


def _moved(saved_ids: list[int], new_ids: list[int]) -> set[int]:
    """Ids of the common items that changed relative order: everything outside a longest in-order run."""
    saved_index = {i: n for n, i in enumerate(saved_ids)}
    common = [i for i in new_ids if i in saved_index]
    seq = [saved_index[i] for i in common]
    best: list[list[int]] = []  # best[k] = indices (into seq) of the longest increasing run ending at k
    for k, value in enumerate(seq):
        prev = max((b for j, b in enumerate(best) if seq[j] < value), key=len, default=[])
        best.append([*prev, k])
    keep = set(max(best, key=len, default=[]))
    return {common[k] for k in range(len(common)) if k not in keep}


def _option_labels(props: dict[str, Any]) -> list[str] | None:
    options = props.get("options")
    return [o.get("label") for o in options] if isinstance(options, list) else None


def _changed_fields(old: ProposalQuestion, new: ProposalQuestion) -> list[str]:
    fields = [f for f in ("title", "description", "required") if getattr(old, f) != getattr(new, f)]
    for key in sorted(set(old.properties) | set(new.properties)):
        a, b = old.properties.get(key), new.properties.get(key)
        if key == "options":
            if _option_labels(old.properties) != _option_labels(new.properties):
                fields.append(key)
        elif a != b:
            fields.append(key)
    return fields


def diff(saved: Proposal, new: Proposal) -> Diff:
    saved_by_id = {q.id: (n, q) for n, q in enumerate(saved.questions) if q.id is not None}
    new_ids = {q.id for q in new.questions if q.id is not None}
    moved = _moved([q.id for q in saved.questions if q.id is not None], [q.id for q in new.questions if q.id is not None])

    to_remove = [
        QuestionSummary(id=q.id, type=q.type, title=q.title, position=n)
        for n, q in enumerate(saved.questions)
        if q.id is not None and q.id not in new_ids
    ]
    to_set: list[QuestionChange] = []
    for n, q in enumerate(new.questions):
        if q.id is None or q.id not in saved_by_id:
            to_set.append(QuestionChange(id=None, type=q.type, title=q.title, position=n, change="new"))
            continue
        fields = _changed_fields(saved_by_id[q.id][1], q)
        if fields:
            to_set.append(QuestionChange(id=q.id, type=q.type, title=q.title, position=n, change="changed", fields=fields, moved=q.id in moved))
        elif q.id in moved:
            to_set.append(QuestionChange(id=q.id, type=q.type, title=q.title, position=n, change="moved", moved=True))

    saved_end = {e.id: (n, e) for n, e in enumerate(saved.endings) if e.id is not None}
    new_end_ids = {e.id for e in new.endings if e.id is not None}
    end_moved = _moved([e.id for e in saved.endings if e.id is not None], [e.id for e in new.endings if e.id is not None])
    end_remove = [EndingSummary(id=e.id, title=e.title, position=n) for n, e in enumerate(saved.endings) if e.id is not None and e.id not in new_end_ids]
    end_set: list[EndingChange] = []
    for n, e in enumerate(new.endings):
        if e.id is None or e.id not in saved_end:
            end_set.append(EndingChange(id=None, title=e.title, position=n, change="new"))
            continue
        fields = [f for f in ("title", "message", "button_text", "button_url") if getattr(saved_end[e.id][1], f) != getattr(e, f)]
        if fields:
            end_set.append(EndingChange(id=e.id, title=e.title, position=n, change="changed", fields=fields, moved=e.id in end_moved))
        elif e.id in end_moved:
            end_set.append(EndingChange(id=e.id, title=e.title, position=n, change="moved", moved=True))

    welcome = [f for f in ProposalWelcome.model_fields if getattr(saved.welcome, f) != getattr(new.welcome, f)]
    return Diff(to_remove=to_remove, to_set=to_set, endings=EndingsDiff(to_remove=end_remove, to_set=end_set), welcome=welcome)
