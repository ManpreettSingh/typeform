"""Per-form summary statistics (API_SPEC.md "Summary shape").

Question stats cover completed responses only, like `response_count`. Aggregation happens in Python:
one query fetches every completed answer for the form, which is plenty for this app's data sizes.
"""

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Answer, Form, Question, Response, ResponseStatus
from app.question_types import get_spec
from app.schemas.response import FormSummary, QuestionSummary

def summarize_question(question: Question, values: list[Any], times: list[datetime]) -> QuestionSummary:
    """`values` are this question's stored answers, most recent first; `times` their submission times."""
    return get_spec(question.type).summarize(question, values, times)


def summarize_form(db: Session, form: Form) -> FormSummary:
    counts = dict(
        db.execute(
            select(Response.status, func.count(Response.id)).where(Response.form_id == form.id).group_by(Response.status)
        ).all()
    )
    total = sum(counts.values())
    completed = counts.get(ResponseStatus.COMPLETED, 0)

    rows = db.execute(
        select(Answer.question_id, Answer.value, Response.submitted_at)
        .join(Response, Answer.response_id == Response.id)
        .where(Response.form_id == form.id, Response.status == ResponseStatus.COMPLETED)
        .order_by(Response.submitted_at.desc(), Response.id.desc())
    ).all()
    values: dict[int, list[Any]] = defaultdict(list)
    times: dict[int, list[datetime]] = defaultdict(list)
    for question_id, value, submitted_at in rows:
        values[question_id].append(value)
        times[question_id].append(submitted_at)

    return FormSummary(
        total_responses=total,
        completed=completed,
        completion_rate=round(completed / total, 4) if total else 0.0,
        views=form.views,
        average_seconds=_average_seconds(db, form),
        questions=[summarize_question(q, values[q.id], times[q.id]) for q in form.questions],
    )


def _average_seconds(db: Session, form: Form) -> float | None:
    """Typeform's "Time to complete". One-shot submissions (no partial start) have no duration and are left out."""
    spans = db.execute(
        select(Response.started_at, Response.submitted_at).where(
            Response.form_id == form.id, Response.status == ResponseStatus.COMPLETED
        )
    ).all()
    seconds = [(end - start).total_seconds() for start, end in spans if end is not None and end > start]
    return round(sum(seconds) / len(seconds), 1) if seconds else None
