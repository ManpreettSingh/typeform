from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.errors import BadRequestError, FieldValidationError, NotFoundError, errors_from_pydantic
from app.models import Form, Question, QuestionType
from app.models.base import utcnow
from app.schemas.properties import default_properties, validate_properties
from app.schemas.question import QuestionCreate, QuestionUpdate


def get_question(db: Session, question_id: int) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise NotFoundError("Question not found")
    return question


def _validated_properties(qtype: QuestionType, data: dict) -> dict:
    try:
        return validate_properties(qtype, data)
    except ValidationError as exc:
        raise FieldValidationError(errors_from_pydantic(exc, prefix="properties")) from exc


def _renumber(db: Session, ordered: list[Question]) -> None:
    """Writes contiguous positions 0..n-1 in list order.

    SQLite can't defer UNIQUE(form_id, position), and the ORM flushes updates in its own order,
    so rows first move to a free range above every current position, then to their final slot.
    """
    if all(q.position == i for i, q in enumerate(ordered)):
        return
    offset = max((q.position for q in ordered if q.position is not None), default=-1) + 1
    for i, q in enumerate(ordered):
        q.position = offset + i
    db.flush()
    for i, q in enumerate(ordered):
        q.position = i
    db.flush()


def _commit_question_change(db: Session, form: Form) -> None:
    form.updated_at = utcnow()
    db.commit()
    # The in-memory collection may be out of order now; reload it on next access.
    db.expire(form, ["questions"])


def create_question(db: Session, form: Form, data: QuestionCreate) -> Question:
    properties = (
        default_properties(data.type)
        if data.properties is None
        else _validated_properties(data.type, data.properties)
    )
    question = Question(
        form_id=form.id,
        type=data.type,
        title=data.title,
        description=data.description,
        required=data.required,
        properties=properties,
    )
    db.add(question)

    ordered = list(form.questions)
    index = len(ordered) if data.position is None else min(data.position, len(ordered))
    ordered.insert(index, question)
    _renumber(db, ordered)
    _commit_question_change(db, form)
    return question


def update_question(db: Session, question: Question, data: QuestionUpdate) -> Question:
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field == "properties":
            value = _validated_properties(QuestionType(question.type), value)
        setattr(question, field, value)
    _commit_question_change(db, question.form)
    return question


def delete_question(db: Session, question: Question) -> None:
    """Deletes the question (its answers cascade in the DB) and closes the gap in positions."""
    form = question.form
    remaining = [q for q in form.questions if q.id != question.id]
    db.delete(question)
    db.flush()
    _renumber(db, remaining)
    _commit_question_change(db, form)


def reorder_questions(db: Session, form: Form, ordered_ids: list[int]) -> list[Question]:
    by_id = {q.id: q for q in form.questions}
    if len(ordered_ids) != len(by_id) or set(ordered_ids) != by_id.keys():
        raise BadRequestError("ordered_ids must list every question of this form exactly once.")
    ordered = [by_id[qid] for qid in ordered_ids]
    _renumber(db, ordered)
    _commit_question_change(db, form)
    return ordered
