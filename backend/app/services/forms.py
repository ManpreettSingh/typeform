import copy
from typing import TypeVar

from sqlalchemy import ColumnElement, func, select
from sqlalchemy.orm import Session

from app.core.errors import BadRequestError, NotFoundError
from app.models import Form, FormStatus, Question, Response, ResponseStatus
from app.models.base import utcnow
from app.schemas.form import FormCreate, FormListItem, FormOut, FormUpdate, ThankYou, Theme
from app.services.slugs import generate_unique_slug

FormSchema = TypeVar("FormSchema", FormOut, FormListItem)


def _response_count_expr() -> ColumnElement[int]:
    # Only completed submissions count; partial responses are a bonus feature tracked separately.
    return (
        select(func.count(Response.id))
        .where(Response.form_id == Form.id, Response.status == ResponseStatus.COMPLETED)
        .correlate(Form)
        .scalar_subquery()
    )


def _question_count_expr() -> ColumnElement[int]:
    return select(func.count(Question.id)).where(Question.form_id == Form.id).correlate(Form).scalar_subquery()


def get_form(db: Session, form_id: int) -> Form:
    form = db.get(Form, form_id)
    if form is None:
        raise NotFoundError("Form not found")
    return form


def list_forms(db: Session) -> list[FormListItem]:
    # One query with correlated counts — no per-form round trips.
    rows = db.execute(
        select(Form, _response_count_expr(), _question_count_expr()).order_by(
            Form.updated_at.desc(), Form.id.desc()
        )
    ).all()
    return [
        _serialize(FormListItem, form, response_count=responses, question_count=questions)
        for form, responses, questions in rows
    ]


def to_form_out(db: Session, form: Form) -> FormOut:
    response_count = db.scalar(
        select(func.count(Response.id)).where(
            Response.form_id == form.id, Response.status == ResponseStatus.COMPLETED
        )
    )
    return _serialize(FormOut, form, response_count=response_count)


def _serialize(schema: type[FormSchema], form: Form, **extra: object) -> FormSchema:
    data = {name: extra[name] if name in extra else getattr(form, name) for name in schema.model_fields}
    return schema.model_validate(data)


def create_form(db: Session, data: FormCreate) -> Form:
    form = Form(
        slug=generate_unique_slug(db),
        title=data.title,
        status=FormStatus.DRAFT,
        theme=Theme().model_dump(),
        thank_you=ThankYou().model_dump(),
    )
    db.add(form)
    db.commit()
    return form


def update_form(db: Session, form: Form, data: FormUpdate) -> Form:
    for field in data.model_fields_set:
        value = getattr(data, field)
        if field in ("theme", "thank_you"):
            value = value.model_dump()
        setattr(form, field, value)
    db.commit()
    return form


def delete_form(db: Session, form: Form) -> None:
    db.delete(form)
    db.commit()


def duplicate_form(db: Session, form: Form) -> Form:
    """Copies the form and its questions (not responses) as a new draft with a fresh slug."""
    title = f"{form.title} (copy)"
    copies = {
        q.id: Question(
            type=q.type,
            title=q.title,
            description=q.description,
            required=q.required,
            position=q.position,
            properties=copy.deepcopy(q.properties),
        )
        for q in form.questions
    }
    clone = Form(
        slug=generate_unique_slug(db),
        title=title[:200],
        description=form.description,
        status=FormStatus.DRAFT,
        theme=copy.deepcopy(form.theme),
        thank_you=copy.deepcopy(form.thank_you),
        questions=list(copies.values()),
    )
    db.add(clone)
    # Jump targets are question ids: point them at the copies once those have ids.
    db.flush()
    for original in form.questions:
        copies[original.id].logic = _remap_logic(original.logic, {old: new.id for old, new in copies.items()})
    db.commit()
    return clone


def _remap_logic(logic: dict | None, ids: dict[int, int]) -> dict | None:
    if not logic:
        return None
    rules = [{**rule, "to": ids.get(rule["to"], rule["to"])} for rule in logic.get("rules", [])]
    # Targets outside the form can't exist (deletes drop them), but never copy a dangling one.
    rules = [rule for rule in rules if rule["to"] == "end" or rule["to"] in ids.values()]
    return {"rules": rules} if rules else None


def publish_form(db: Session, form: Form) -> Form:
    if not form.questions:
        raise BadRequestError("Add at least one question before publishing.")
    form.status = FormStatus.PUBLISHED
    form.published_at = utcnow()
    db.commit()
    return form


def unpublish_form(db: Session, form: Form) -> Form:
    form.status = FormStatus.DRAFT
    db.commit()
    return form
