from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import NotFoundError
from app.models import Form, Response, ResponseStatus
from app.schemas.response import ResponseAnswer, ResponseDetail, ResponseListItem, ResponsePage


def _newest_first():
    # Completed responses sort by submission time, partial ones by when they started.
    return func.coalesce(Response.submitted_at, Response.started_at).desc(), Response.id.desc()


def list_responses(
    db: Session, form: Form, page: int, page_size: int, status: ResponseStatus | None = None
) -> ResponsePage:
    filters = [Response.form_id == form.id]
    if status is not None:
        filters.append(Response.status == status)

    total = db.scalar(select(func.count(Response.id)).where(*filters)) or 0
    rows = db.scalars(
        select(Response)
        .where(*filters)
        .order_by(*_newest_first())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .options(selectinload(Response.answers))
    ).all()

    items = [
        ResponseListItem(
            id=r.id,
            status=r.status,
            started_at=r.started_at,
            submitted_at=r.submitted_at,
            answers={a.question_id: a.value for a in r.answers},
        )
        for r in rows
    ]
    return ResponsePage(items=items, total=total, page=page, page_size=page_size)


def get_response(db: Session, form: Form, response_id: int) -> Response:
    response = db.get(Response, response_id)
    # A response id from another form is reported as missing, not as a mismatch.
    if response is None or response.form_id != form.id:
        raise NotFoundError("Response not found")
    return response


def to_detail(form: Form, response: Response) -> ResponseDetail:
    by_question = {a.question_id: a.value for a in response.answers}
    answers = [
        ResponseAnswer(question_id=q.id, question_title=q.title, question_type=q.type, value=by_question[q.id])
        for q in form.questions
        if q.id in by_question
    ]
    return ResponseDetail(
        id=response.id,
        status=response.status,
        started_at=response.started_at,
        submitted_at=response.submitted_at,
        answers=answers,
    )


def delete_response(db: Session, response: Response) -> None:
    db.delete(response)
    db.commit()
