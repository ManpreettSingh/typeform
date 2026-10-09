"""Saves a reviewed proposal ("Apply changes to form") in ONE transaction.

The client's proposal is never trusted: everything is checked first (ids belong to this form, types match, properties validate
like a manual edit, groups stay whole), and only then rows are written. One commit at the end, a rollback on any failure, so a
bad proposal leaves the form exactly as it was.
"""

from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.errors import FieldValidationError, errors_from_pydantic
from app.models import Form, FormStatus, Question, QuestionType
from app.models.base import utcnow
from app.models.ending import Ending
from app.question_types import get_spec
from app.schemas.form import ThankYou, Theme, Welcome
from app.schemas.properties import validate_properties
from app.services import ai_form
from app.services import forms as form_service
from app.services.ai_schemas import ApplyIn, Proposal
from app.services.questions import _renumber, without_jumps_to
from app.services.slugs import generate_unique_slug

PROVISIONAL = 1_000_000  # positions above any real one, so UNIQUE(form_id, position) never collides mid-way


def apply_proposal(db: Session, data: ApplyIn) -> Form:
    form = form_service.get_form(db, data.form_id) if data.form_id is not None else None
    try:
        form = _apply(db, form, data.proposal)
        db.commit()
    except Exception:
        db.rollback()
        raise
    db.refresh(form)
    db.expire(form, ["questions", "endings"])
    return form


def _check(form: Form | None, p: Proposal) -> tuple[dict[int, dict[str, Any]], dict[str, str]]:
    """Validates the proposal against the saved form. Returns validated properties per question index and the errors."""
    errors: dict[str, str] = {}
    saved_q = {q.id: q for q in form.questions} if form else {}
    saved_e = {e.id: e for e in form.endings} if form else {}
    proposal_ids = [q.id for q in p.questions if q.id is not None]
    kept_groups = {q.id for q in p.questions if q.id is not None and q.type == QuestionType.GROUP}
    validated: dict[int, dict[str, Any]] = {}

    if len(proposal_ids) != len(set(proposal_ids)):
        errors["questions"] = "A question appears twice"
    for i, q in enumerate(p.questions):
        key = f"questions.{i}"
        if q.id is not None:
            saved = saved_q.get(q.id)
            if saved is None:
                errors[key] = "This question isn't part of the form"
                continue
            if saved.type != q.type.value:
                errors[key] = "A question's type can't change: replace it with a new question"
                continue
        elif q.type not in ai_form.CREATABLE:
            errors[key] = "This kind of question can't be added by the AI"
            continue
        if q.group_id is not None and q.group_id not in kept_groups:
            errors[f"{key}.group_id"] = "That group isn't part of the form"
        if q.type == QuestionType.GROUP:
            continue  # groups are never changed by the AI
        try:
            validated[i] = validate_properties(q.type, q.properties)
        except ValidationError as exc:
            errors.update(errors_from_pydantic(exc, prefix=f"{key}.properties"))

    # A group may only go when none of its saved children stays.
    for gid, group in ((i, q) for i, q in saved_q.items() if q.type == QuestionType.GROUP):
        if gid in kept_groups:
            continue
        stays = [c.id for c in saved_q.values() if c.group_id == gid and c.id in proposal_ids]
        if stays:
            errors["questions"] = f"The group “{group.title}” can't be removed while its questions stay"

    end_ids = [e.id for e in p.endings if e.id is not None]
    if len(end_ids) != len(set(end_ids)):
        errors["endings"] = "An ending appears twice"
    for i, e in enumerate(p.endings):
        if e.id is not None and e.id not in saved_e:
            errors[f"endings.{i}"] = "This ending isn't part of the form"
    return validated, errors


def _apply(db: Session, form: Form | None, p: Proposal) -> Form:
    validated, errors = _check(form, p)
    if errors:
        raise FieldValidationError(errors)

    if form is None:
        form = Form(
            slug=generate_unique_slug(db),
            title=p.welcome.title,
            status=FormStatus.DRAFT,
            theme=Theme().model_dump(),
            thank_you=ThankYou().model_dump(),
            welcome=Welcome().model_dump(),
        )
        db.add(form)
        db.flush()

    # ---- form + welcome screen
    form.title = p.welcome.title
    form.description = p.welcome.description
    form.welcome = {
        **(form.welcome or {}),
        "button_text": p.welcome.button_text,
        "show_time_to_complete": p.welcome.show_time_to_complete,
        "show_submission_count": p.welcome.show_submission_count,
    }

    # ---- questions
    saved = {q.id: q for q in form.questions}
    keep = {q.id for q in p.questions if q.id is not None}
    removed = sorted((q for q in saved.values() if q.id not in keep), key=lambda q: q.type == QuestionType.GROUP)
    for q in removed:  # children before their header: the DB cascade must not meet rows the session still tracks
        db.delete(q)
        db.flush()
    removed_ids = {q.id for q in removed}
    for q in saved.values():
        if q.id in keep and removed_ids:
            q.logic = without_jumps_to(q.logic, removed_ids)

    ordered: list[Question] = []
    for i, item in enumerate(p.questions):
        answerable = get_spec(item.type).answerable
        if item.id is not None:
            row = saved[item.id]
            if item.type != QuestionType.GROUP:
                row.title, row.description = item.title, item.description
                row.required = item.required and answerable
                row.properties = validated[i]
        else:
            row = Question(
                form_id=form.id,
                type=item.type,
                title=item.title,
                description=item.description,
                required=item.required and answerable,
                properties=validated[i],
                position=PROVISIONAL + i,
            )
            db.add(row)
        row.group_id = item.group_id if item.type != QuestionType.GROUP else None
        ordered.append(row)
    db.flush()
    _renumber(db, ordered)

    # ---- endings
    saved_ends = {e.id: e for e in form.endings}
    keep_ends = {e.id for e in p.endings if e.id is not None}
    for e in [e for e in saved_ends.values() if e.id not in keep_ends]:
        db.delete(e)
    db.flush()
    ends: list[Ending] = []
    for i, item in enumerate(p.endings):
        if item.id is not None:
            row = saved_ends[item.id]
            row.title, row.message, row.button_text, row.button_url = item.title, item.message, item.button_text, item.button_url
        else:
            row = Ending(
                form_id=form.id,
                position=PROVISIONAL + i,
                title=item.title,
                message=item.message,
                button_text=item.button_text,
                button_url=item.button_url,
            )
            db.add(row)
        ends.append(row)
    db.flush()
    for i, e in enumerate(ends):  # two steps: UNIQUE(form_id, position) can't be deferred in SQLite
        e.position = PROVISIONAL * 2 + i
    db.flush()
    for i, e in enumerate(ends):
        e.position = i
    db.flush()

    form.updated_at = utcnow()
    return form
