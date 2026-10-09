"""The date question: stored as "YYYY-MM-DD", shown in the question's own format and separator."""

import random
import re
from datetime import date, datetime, timedelta
from typing import Any

from app.models import Question, QuestionType
from app.question_types.base import AnswerError, Properties, QuestionTypeSpec
from app.schemas.properties import DateProperties
from app.schemas.response import TextAnswer, TextSummary

# Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
INVALID_MESSAGE = "That date doesn't look valid—it's incomplete or doesn't exist"
REVERSED_MESSAGE = "That date isn't valid. Check the month and day aren't reversed."

_PARTS = re.compile(r"^(\d{4})-(\d{1,2})-(\d{1,2})$")
_DATE_OPS = frozenset({"is", "is_not", "lt", "lte", "gt", "gte"})


def display(value: date, props: Properties) -> str:
    """The date as the respondent sees it, e.g. 07.03.2026 for DDMMYYYY with ".".""" 
    parts = {"MM": f"{value.month:02d}", "DD": f"{value.day:02d}", "YYYY": f"{value.year:04d}"}
    order = re.findall(r"MM|DD|YYYY", props.get("format", "MMDDYYYY"))
    return props.get("separator", "/").join(parts[p] for p in order)


def _parse_iso(value: Any) -> date | None:
    """A real date from "YYYY-MM-DD" (one or two digit month and day); None for anything else."""
    match = _PARTS.match(value.strip()) if isinstance(value, str) else None
    if not match:
        return None
    try:
        return date(*(int(g) for g in match.groups()))
    except ValueError:
        return None


def _validate(value: Any, props: Properties) -> str:
    match = _PARTS.match(value.strip()) if isinstance(value, str) else None
    if not match:
        raise AnswerError(INVALID_MESSAGE)
    year, month, day = (int(g) for g in match.groups())
    try:
        parsed = date(year, month, day)
    except ValueError:
        if month > 12 and 1 <= day <= 12:
            try:
                date(year, day, month)
            except ValueError:
                pass
            else:
                raise AnswerError(REVERSED_MESSAGE) from None  # typed day and month the other way round
        raise AnswerError(INVALID_MESSAGE) from None

    low = _parse_iso(props.get("start_date"))
    high = _parse_iso(props.get("end_date"))
    if low and high and not low <= parsed <= high:
        raise AnswerError(f"Choose a date between {display(low, props)} and {display(high, props)}.")
    if low and parsed < low:
        raise AnswerError(f"Choose a date on or after {display(low, props)}.")
    if high and parsed > high:
        raise AnswerError(f"Choose a date on or before {display(high, props)}.")
    return parsed.isoformat()


def _format(value: Any, props: Properties) -> str:
    parsed = _parse_iso(value)
    return display(parsed, props) if parsed else str(value)


def _summarize(question: Question, values: list[Any], times: list[datetime]) -> TextSummary:
    return TextSummary(
        question_id=question.id,
        type=QuestionType.DATE,
        title=question.title,
        answered=len(values),
        answers=[TextAnswer(value=_format(v, question.properties), submitted_at=t) for v, t in zip(values, times, strict=True)],
    )


def _sample(props: Properties, rng: random.Random) -> str:
    low = _parse_iso(props.get("start_date"))
    high = _parse_iso(props.get("end_date"))
    if low is None and high is None:
        low = date(2024, 1, 1)
    if low is None:
        low = high - timedelta(days=730)
    if high is None:
        high = low + timedelta(days=730)
    return (low + timedelta(days=rng.randint(0, (high - low).days))).isoformat()


def _match(op: str, expected: Any, value: Any, _props: Properties) -> bool:
    a, b = _parse_iso(value), _parse_iso(expected)
    if a is None or b is None:
        return False
    return {"is": a == b, "is_not": a != b, "lt": a < b, "lte": a <= b, "gt": a > b, "gte": a >= b}.get(op, False)


def _rule_error(value: Any) -> str | None:
    return None if _parse_iso(value) else "Enter a date"


SPECS = [
    QuestionTypeSpec(
        key=QuestionType.DATE,
        properties_model=DateProperties,
        answerable=True,
        defaults=lambda: DateProperties().model_dump(exclude_none=True),
        validate=_validate,
        format=_format,
        summarize=_summarize,
        sample=_sample,
        logic_ops=_DATE_OPS,
        logic_match=_match,
        logic_value_error=_rule_error,
    )
]
