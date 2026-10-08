"""Per-form summary statistics (API_SPEC.md "Summary shape").

Question stats cover completed responses only, like `response_count`. Aggregation happens in Python:
one query fetches every completed answer for the form, which is plenty for this app's data sizes.
"""

from collections import defaultdict
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Answer, Form, Question, QuestionType, Response, ResponseStatus
from app.schemas.response import (
    ChoiceSummary,
    FormSummary,
    NumberSummary,
    OptionCount,
    QuestionSummary,
    RatingSummary,
    TextAnswer,
    TextSummary,
)

YES_NO_OPTIONS = [("yes", "Yes"), ("no", "No")]


def _average(numbers: list[float]) -> float | None:
    return round(sum(numbers) / len(numbers), 2) if numbers else None


def _choice(question: Question, values: list[Any]) -> ChoiceSummary:
    qtype = QuestionType(question.type)
    if qtype == QuestionType.YES_NO:
        options = YES_NO_OPTIONS
        picked = [["yes" if v else "no"] for v in values]
    else:
        options = [(o["id"], o["label"]) for o in question.properties["options"]]
        picked = [v if isinstance(v, list) else [v] for v in values]

    counts: dict[str, int] = defaultdict(int)
    for ids in picked:
        for option_id in ids:
            counts[option_id] += 1
    # Answers naming options the creator has since removed aren't listed.
    return ChoiceSummary(
        question_id=question.id,
        type=qtype,
        title=question.title,
        answered=len(values),
        counts=[OptionCount(option_id=oid, label=label, count=counts[oid]) for oid, label in options],
    )


def _rating(question: Question, values: list[Any]) -> RatingSummary:
    top = question.properties["max"]
    distribution = {str(step): 0 for step in range(1, top + 1)}
    for v in values:
        # Answers above a since-lowered max still count toward the average, not the distribution.
        if str(v) in distribution:
            distribution[str(v)] += 1
    return RatingSummary(
        question_id=question.id,
        type=QuestionType.RATING,
        title=question.title,
        answered=len(values),
        max=top,
        average=_average(values),
        distribution=distribution,
    )


def _number(question: Question, values: list[Any]) -> NumberSummary:
    return NumberSummary(
        question_id=question.id,
        type=QuestionType.NUMBER,
        title=question.title,
        answered=len(values),
        min=min(values, default=None),
        max=max(values, default=None),
        average=_average(values),
    )


def _text(question: Question, values: list[Any], times: list[datetime]) -> TextSummary:
    return TextSummary(
        question_id=question.id,
        type=QuestionType(question.type),
        title=question.title,
        answered=len(values),
        answers=[TextAnswer(value=str(v), submitted_at=t) for v, t in zip(values, times, strict=True)],
    )


_SUMMARIZERS = {
    QuestionType.MULTIPLE_CHOICE: _choice,
    QuestionType.DROPDOWN: _choice,
    QuestionType.YES_NO: _choice,
    QuestionType.RATING: _rating,
    QuestionType.NUMBER: _number,
}


_TEXT_TYPES = {QuestionType.SHORT_TEXT, QuestionType.LONG_TEXT, QuestionType.EMAIL}


def summarize_question(question: Question, values: list[Any], times: list[datetime]) -> QuestionSummary:
    """`values` are this question's stored answers, most recent first; `times` their submission times."""
    if QuestionType(question.type) in _TEXT_TYPES:
        return _text(question, values, times)
    return _SUMMARIZERS[QuestionType(question.type)](question, values)


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
