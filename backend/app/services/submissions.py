import secrets
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError
from app.models import Answer, Form, FormStatus, QuestionType, Response, ResponseStatus
from app.models.base import utcnow
from app.services import payments
from app.services.validation import validate_answers


def get_published_form(db: Session, slug: str) -> Form:
    """Drafts are reported as missing so their existence isn't revealed."""
    form = db.scalar(select(Form).where(Form.slug == slug, Form.status == FormStatus.PUBLISHED))
    if form is None:
        raise NotFoundError("Form not found")
    return form


def record_view(db: Session, form: Form) -> None:
    # Atomic increment: concurrent visits don't overwrite each other.
    db.execute(update(Form).where(Form.id == form.id).values(views=Form.views + 1))
    db.commit()


def create_submission(db: Session, form: Form, answers: dict[str, Any]) -> Response:
    """Validates every answer, then stores a completed response and its answers in one transaction."""
    cleaned = validate_answers(form.questions, answers)
    payments.verify_submission(db, form, cleaned)
    now = utcnow()
    response = Response(
        form_id=form.id,
        status=ResponseStatus.COMPLETED,
        started_at=now,
        submitted_at=now,
        answers=[Answer(question_id=qid, value=value) for qid, value in cleaned.items()],
    )
    db.add(response)
    db.commit()
    return response


def start_response(db: Session, form: Form) -> Response:
    """Creates an empty partial response. Its token is required to save progress on it."""
    response = Response(
        form_id=form.id,
        status=ResponseStatus.PARTIAL,
        started_at=utcnow(),
        meta={"token": secrets.token_urlsafe(16)},
    )
    db.add(response)
    db.commit()
    return response


def get_open_response(db: Session, response_id: int, token: str) -> Response:
    """A partial response of a published form, if `token` matches. Anything else is reported as missing."""
    response = db.get(Response, response_id)
    stored = (response.meta or {}).get("token") if response else None
    if (
        response is None
        or not isinstance(stored, str)
        or not secrets.compare_digest(stored, token)
        or response.form.status != FormStatus.PUBLISHED
    ):
        raise NotFoundError("Response not found")
    meta = response.meta or {}
    # A response submitted at a Partial Submit Point stays open until the respondent finishes the form.
    still_open = meta.get("partial_submitted") and not meta.get("final")
    if response.status == ResponseStatus.COMPLETED and not still_open:
        raise ConflictError("This response was already submitted.")
    return response


def save_progress(
    db: Session, response: Response, answers: dict[str, Any], complete: bool, partial_submit: bool = False
) -> Response:
    """Replaces the stored answers. `complete` validates like a full submission and marks it completed.

    `partial_submit` (the respondent reached a Partial Submit Point) also marks it completed, with the answers so far
    and the usual leniency about required questions further on; the response stays open for the rest of the form.
    """
    # The flag means nothing for a form without a point (it may have been removed since the page loaded).
    reached_point = partial_submit and not complete and any(q.type == QuestionType.PARTIAL_SUBMIT for q in response.form.questions)
    cleaned = validate_answers(response.form.questions, answers, partial=not complete)
    if complete or reached_point:
        payments.verify_submission(db, response.form, cleaned, response_id=response.id)

    # Update rows in place: replacing the collection could insert before deleting and hit the unique key.
    existing = {a.question_id: a for a in response.answers}
    for qid, answer in existing.items():
        if qid not in cleaned:
            response.answers.remove(answer)
    for qid, value in cleaned.items():
        if qid in existing:
            existing[qid].value = value
        else:
            response.answers.append(Answer(question_id=qid, value=value))

    if complete:
        response.status = ResponseStatus.COMPLETED
        response.submitted_at = utcnow()
        response.meta = {**(response.meta or {}), "final": True}
    elif reached_point and response.status != ResponseStatus.COMPLETED:
        response.status = ResponseStatus.COMPLETED
        response.submitted_at = utcnow()
        response.meta = {**(response.meta or {}), "partial_submitted": True}
    db.commit()
    return response
