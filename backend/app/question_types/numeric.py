"""Number, rating, opinion scale and NPS."""

import math
import random
from datetime import datetime
from typing import Any

from app.models import Question, QuestionType
from app.question_types.base import AnswerError, Properties, QuestionTypeSpec, average, is_number
from app.schemas.properties import NpsProperties, NumberProperties, OpinionScaleProperties, RatingProperties
from app.schemas.response import NpsGroup, NpsSummary, NumberSummary, RatingSummary, ScaleSummary

_NUMBER_OPS = frozenset({"eq", "neq", "lt", "lte", "gt", "gte"})
# NPS groups respondents by score: promoters 9–10, passives 7–8, detractors 0–6.
_NPS_RANGE = (0, 10)
_PROMOTER_FROM = 9
_DETRACTOR_UP_TO = 6


def _format_number(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(n)


def _in_range(value: Any, low: int, high: int) -> bool:
    return isinstance(value, int) and not isinstance(value, bool) and low <= value <= high


def _scale_range(props: Properties) -> tuple[int, int]:
    """First and last step of an opinion scale: it starts at 1 (or 0) and has `steps` steps."""
    low = 1 if props["start_at_one"] else 0
    return low, low + props["steps"] - 1


def _validate_number(value: Any, props: Properties) -> int | float:
    if not is_number(value) or not math.isfinite(value):
        raise AnswerError("Please enter a number")
    low, high = props.get("min"), props.get("max")
    if low is not None and value < low:
        raise AnswerError(f"Please enter a number of {_format_number(low)} or more")
    if high is not None and value > high:
        raise AnswerError(f"Please enter a number of {_format_number(high)} or less")
    return value


def _validate_rating(value: Any, props: Properties) -> int:
    if not _in_range(value, 1, props["max"]):
        raise AnswerError("Please choose a rating")
    return value


def _validate_opinion_scale(value: Any, props: Properties) -> int:
    if not _in_range(value, *_scale_range(props)):
        raise AnswerError("Please choose a rating")
    return value


def _validate_nps(value: Any, _props: Properties) -> int:
    if not _in_range(value, *_NPS_RANGE):
        raise AnswerError("Please choose a rating")
    return value


def _format_plain(value: Any, _props: Properties) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _format_rating(value: Any, props: Properties) -> str:
    return f"{value}/{props['max']}"


def _distribution(values: list[Any], low: int, high: int) -> dict[str, int]:
    """Every step from `low` to `high` with its count. Answers outside a since-edited range aren't listed."""
    counts = {str(step): 0 for step in range(low, high + 1)}
    for v in values:
        if str(v) in counts:
            counts[str(v)] += 1
    return counts


def _summarize_number(question: Question, values: list[Any], _times: list[datetime]) -> NumberSummary:
    return NumberSummary(
        question_id=question.id,
        type=QuestionType.NUMBER,
        title=question.title,
        answered=len(values),
        min=min(values, default=None),
        max=max(values, default=None),
        average=average(values),
    )


def _summarize_rating(question: Question, values: list[Any], _times: list[datetime]) -> RatingSummary:
    top = question.properties["max"]
    # Answers above a since-lowered max still count toward the average, not the distribution.
    return RatingSummary(
        question_id=question.id,
        type=QuestionType.RATING,
        title=question.title,
        answered=len(values),
        max=top,
        average=average(values),
        distribution=_distribution(values, 1, top),
    )


def _summarize_opinion_scale(question: Question, values: list[Any], _times: list[datetime]) -> ScaleSummary:
    low, high = _scale_range(question.properties)
    return ScaleSummary(
        question_id=question.id,
        type=QuestionType.OPINION_SCALE,
        title=question.title,
        answered=len(values),
        min=low,
        max=high,
        average=average(values),
        distribution=_distribution(values, low, high),
    )


def _summarize_nps(question: Question, values: list[Any], _times: list[datetime]) -> NpsSummary:
    total = len(values)
    promoters = sum(1 for v in values if v >= _PROMOTER_FROM)
    detractors = sum(1 for v in values if v <= _DETRACTOR_UP_TO)

    def group(count: int) -> NpsGroup:
        return NpsGroup(count=count, percent=round(100 * count / total, 1) if total else 0)

    return NpsSummary(
        question_id=question.id,
        type=QuestionType.NPS,
        title=question.title,
        answered=total,
        average=average(values),
        distribution=_distribution(values, *_NPS_RANGE),
        promoters=group(promoters),
        passives=group(total - promoters - detractors),
        detractors=group(detractors),
        # % promoters − % detractors, rounded half up to a whole number.
        score=math.floor(100 * (promoters - detractors) / total + 0.5) if total else None,
    )


def _sample_number(props: Properties, rng: random.Random) -> float | int:
    low, high = props.get("min"), props.get("max")
    if low is None and high is None:
        return rng.randint(1, 100)
    if low is None:
        low = high - 100
    if high is None:
        high = low + 100
    lo, hi = math.ceil(low), math.floor(high)
    # A range without a whole number in it (e.g. 1.2–1.8) gets a decimal answer.
    return rng.randint(lo, hi) if lo <= hi else round(rng.uniform(low, high), 2)


def _sample_rating(props: Properties, rng: random.Random) -> int:
    return rng.randint(1, props["max"])


def _sample_opinion_scale(props: Properties, rng: random.Random) -> int:
    return rng.randint(*_scale_range(props))


def _sample_nps(_props: Properties, rng: random.Random) -> int:
    return rng.randint(*_NPS_RANGE)


def _number_or_none(value: Any) -> float | None:
    return value if is_number(value) else None


def _match_number(op: str, expected: Any, value: Any, _props: Properties) -> bool:
    a, b = _number_or_none(value), _number_or_none(expected)
    if a is None or b is None:
        return False
    return {"eq": a == b, "neq": a != b, "lt": a < b, "lte": a <= b, "gt": a > b, "gte": a >= b}.get(op, False)


def _rule_error(value: Any) -> str | None:
    return None if is_number(value) else "Enter a number"


SPECS = [
    QuestionTypeSpec(
        key=QuestionType.NUMBER,
        properties_model=NumberProperties,
        answerable=True,
        defaults=lambda: NumberProperties().model_dump(exclude_none=True),
        validate=_validate_number,
        format=_format_plain,
        summarize=_summarize_number,
        sample=_sample_number,
        logic_ops=_NUMBER_OPS,
        logic_match=_match_number,
        logic_value_error=_rule_error,
    ),
    QuestionTypeSpec(
        key=QuestionType.RATING,
        properties_model=RatingProperties,
        answerable=True,
        defaults=lambda: RatingProperties().model_dump(exclude_none=True),
        validate=_validate_rating,
        format=_format_rating,
        summarize=_summarize_rating,
        sample=_sample_rating,
        logic_ops=_NUMBER_OPS,
        logic_match=_match_number,
        logic_value_error=_rule_error,
    ),
    QuestionTypeSpec(
        key=QuestionType.OPINION_SCALE,
        properties_model=OpinionScaleProperties,
        answerable=True,
        defaults=lambda: OpinionScaleProperties().model_dump(exclude_none=True),
        validate=_validate_opinion_scale,
        format=_format_plain,
        summarize=_summarize_opinion_scale,
        sample=_sample_opinion_scale,
        logic_ops=_NUMBER_OPS,
        logic_match=_match_number,
        logic_value_error=_rule_error,
    ),
    QuestionTypeSpec(
        key=QuestionType.NPS,
        properties_model=NpsProperties,
        answerable=True,
        defaults=lambda: NpsProperties().model_dump(exclude_none=True),
        validate=_validate_nps,
        format=_format_plain,
        summarize=_summarize_nps,
        sample=_sample_nps,
        logic_ops=_NUMBER_OPS,
        logic_match=_match_number,
        logic_value_error=_rule_error,
    ),
]
