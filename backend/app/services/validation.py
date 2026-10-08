"""Answer validation for public submissions (API_SPEC.md "Validation rules").

Mirrored by frontend/lib/validation.ts; this module is authoritative. Messages match the client's
so a server-side rejection reads the same as a client-side one.
"""

import math
import re
from collections.abc import Callable, Sequence
from typing import Any

from app.core.errors import FieldValidationError
from app.models import Question, QuestionType
from app.services.logic import next_index

# RFC-lite: something@something.tld, no spaces.
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Upper bound for text answers whose question sets no max_length.
TEXT_ANSWER_MAX = 10_000

REQUIRED_MESSAGE = "Please fill this in"
UNKNOWN_QUESTION_MESSAGE = "Unknown question"


class AnswerError(ValueError):
    pass


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def _is_number(value: Any) -> bool:
    # bool is an int subclass in Python; JSON true/false must not pass as numbers.
    return isinstance(value, int | float) and not isinstance(value, bool)


def _text(value: Any, props: dict[str, Any]) -> str:
    if not isinstance(value, str):
        raise AnswerError("Please enter some text")
    text = value.strip()
    limit = props.get("max_length") or TEXT_ANSWER_MAX
    if len(text) > limit:
        raise AnswerError(f"Please keep it under {limit} characters")
    return text


def _email(value: Any, _props: dict[str, Any]) -> str:
    if not isinstance(value, str) or not EMAIL_RE.match(value.strip()):
        raise AnswerError("Hmm… that email doesn't look right")
    return value.strip()


def _format_number(n: float) -> str:
    return str(int(n)) if float(n).is_integer() else str(n)


def _number(value: Any, props: dict[str, Any]) -> int | float:
    if not _is_number(value) or not math.isfinite(value):
        raise AnswerError("Please enter a number")
    low, high = props.get("min"), props.get("max")
    if low is not None and value < low:
        raise AnswerError(f"Please enter a number of {_format_number(low)} or more")
    if high is not None and value > high:
        raise AnswerError(f"Please enter a number of {_format_number(high)} or less")
    return value


def _rating(value: Any, props: dict[str, Any]) -> int:
    if not isinstance(value, int) or isinstance(value, bool) or not 1 <= value <= props["max"]:
        raise AnswerError("Please choose a rating")
    return value


def _yes_no(value: Any, _props: dict[str, Any]) -> bool:
    if not isinstance(value, bool):
        raise AnswerError("Please choose Yes or No")
    return value


def _option_ids(props: dict[str, Any]) -> list[str]:
    return [option["id"] for option in props["options"]]


def _multiple_choice(value: Any, props: dict[str, Any]) -> str | list[str]:
    ids = _option_ids(props)
    if not props.get("allow_multiple"):
        if isinstance(value, list):
            raise AnswerError("Please choose one option")
        if value not in ids:
            raise AnswerError("Please choose from the options")
        return value
    if not isinstance(value, list) or not all(isinstance(v, str) and v in ids for v in value):
        raise AnswerError("Please choose from the options")
    if len(set(value)) != len(value):
        raise AnswerError("Please choose each option only once")
    # Stored in the creator's option order, whatever order they were picked in.
    return [option_id for option_id in ids if option_id in value]


def _dropdown(value: Any, props: dict[str, Any]) -> str:
    if not isinstance(value, str) or value not in _option_ids(props):
        raise AnswerError("Please choose from the list")
    return value


VALIDATORS: dict[QuestionType, Callable[[Any, dict[str, Any]], Any]] = {
    QuestionType.SHORT_TEXT: _text,
    QuestionType.LONG_TEXT: _text,
    QuestionType.EMAIL: _email,
    QuestionType.NUMBER: _number,
    QuestionType.RATING: _rating,
    QuestionType.YES_NO: _yes_no,
    QuestionType.MULTIPLE_CHOICE: _multiple_choice,
    QuestionType.DROPDOWN: _dropdown,
}


def validate_answer(question: Question, value: Any) -> Any:
    """Returns the normalised value to store. Raises AnswerError; callers handle emptiness first."""
    return VALIDATORS[QuestionType(question.type)](value, question.properties)


def validate_answers(
    questions: Sequence[Question], answers: dict[str, Any], *, partial: bool = False
) -> dict[int, Any]:
    """Checks a submission and returns `{question_id: value}` for the non-empty answers.

    Follows the respondent's path through the form (branching, services/logic.py): only questions on
    it are checked, and answers to questions the path skips are dropped. With `partial`, required
    questions may be left empty (progress saved mid-form).

    Raises FieldValidationError keyed by question id (as a string) for every problem at once.
    Empty optional answers are dropped, not stored.
    """
    known = {str(q.id) for q in questions}
    errors = {key: UNKNOWN_QUESTION_MESSAGE for key in answers if key not in known}
    cleaned: dict[int, Any] = {}

    index = 0 if questions else None
    while index is not None:
        question = questions[index]
        key = str(question.id)
        value = answers.get(key)
        if is_empty(value):
            if question.required and not partial:
                errors[key] = REQUIRED_MESSAGE
        else:
            try:
                cleaned[question.id] = validate_answer(question, value)
            except AnswerError as exc:
                # An invalid answer can't pick a branch; the path continues as if it were unanswered.
                errors[key] = str(exc)
        index = next_index(questions, index, cleaned)

    if errors:
        raise FieldValidationError(errors)
    return cleaned
