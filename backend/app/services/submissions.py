from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Answer, Form, FormStatus, Response, ResponseStatus
from app.models.base import utcnow
from app.services.validation import validate_answers


def get_published_form(db: Session, slug: str) -> Form:
    """Drafts are reported as missing so their existence isn't revealed."""
    form = db.scalar(select(Form).where(Form.slug == slug, Form.status == FormStatus.PUBLISHED))
    if form is None:
        raise NotFoundError("Form not found")
    return form


def create_submission(db: Session, form: Form, answers: dict[str, Any]) -> Response:
    """Validates every answer, then stores a completed response and its answers in one transaction."""
    cleaned = validate_answers(form.questions, answers)
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
