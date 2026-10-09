"""Answer validation for public submissions (API_SPEC.md "Validation rules").

Mirrored by frontend/lib/validation.ts; this module is authoritative. The per-type rules live in the type's spec
(app/question_types); messages match the client's so a server-side rejection reads the same as a client-side one.
"""

from collections.abc import Sequence
from typing import Any

from app.core.errors import FieldValidationError
from app.models import Question
from app.question_types import AnswerError, get_spec
from app.question_types.text import EMAIL_RE, TEXT_ANSWER_MAX  # noqa: F401  (re-exported for callers and tests)
from app.services.logic import next_index

REQUIRED_MESSAGE = "Please fill this in"
UNKNOWN_QUESTION_MESSAGE = "Unknown question"


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str):
        return value.strip() == ""
    if isinstance(value, list):
        return len(value) == 0
    return False


def validate_answer(question: Question, value: Any) -> Any:
    """Returns the normalised value to store. Raises AnswerError; callers handle emptiness first."""
    return get_spec(question.type).validate(value, question.properties)


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
    known = {str(q.id) for q in questions if get_spec(q.type).answerable}
    errors = {key: UNKNOWN_QUESTION_MESSAGE for key in answers if key not in known}
    cleaned: dict[int, Any] = {}

    index = 0 if questions else None
    while index is not None:
        question = questions[index]
        spec = get_spec(question.type)
        if not spec.answerable:
            index = next_index(questions, index, cleaned)
            continue
        key = str(question.id)
        value = answers.get(key)
        required = (question.required or spec.always_required) and not partial
        if is_empty(value):
            if required:
                errors[key] = spec.required_message or REQUIRED_MESSAGE
        else:
            try:
                stored = validate_answer(question, value)
            except AnswerError as exc:
                # An invalid answer can't pick a branch; the path continues as if it were unanswered.
                errors[key] = str(exc)
            else:
                if required and spec.satisfies_required and not spec.satisfies_required(stored):
                    errors[key] = spec.required_message or REQUIRED_MESSAGE
                else:
                    cleaned[question.id] = stored
        index = next_index(questions, index, cleaned)

    if errors:
        raise FieldValidationError(errors)
    return cleaned
