"""Typeform's "Generate test response": a completed response with plausible random answers.

Every question gets an answer, then the normal validation keeps only the ones on the path the answers
take (branching), exactly like a real submission. Test rows are marked in `meta` so they can be told
apart later.
"""

import math
import random
from datetime import timedelta
from typing import Any

from app.core.errors import BadRequestError
from app.models import Answer, Form, Question, QuestionType, Response, ResponseStatus
from app.models.base import utcnow
from app.services.validation import validate_answers

_NAMES = ["Alex Morgan", "Priya Shah", "Sam Lee", "Jordan Diaz", "Maya Chen", "Chris Novak", "Aisha Bello"]
_SENTENCES = [
    "Really smooth experience overall.",
    "It took me a moment to find the settings, but after that everything was clear.",
    "Great support team, they answered within minutes.",
    "I'd love to see more templates.",
    "Nothing to add, thanks!",
]


def _text(question: Question, pool: list[str]) -> str:
    value = random.choice(pool)
    limit = question.properties.get("max_length")
    return value[:limit] if limit else value


def _number(props: dict[str, Any]) -> float | int:
    low, high = props.get("min"), props.get("max")
    if low is None and high is None:
        return random.randint(1, 100)
    if low is None:
        low = high - 100
    if high is None:
        high = low + 100
    lo, hi = math.ceil(low), math.floor(high)
    # A range without a whole number in it (e.g. 1.2–1.8) gets a decimal answer.
    return random.randint(lo, hi) if lo <= hi else round(random.uniform(low, high), 2)


def _answer(question: Question) -> Any:
    props = question.properties
    match QuestionType(question.type):
        case QuestionType.SHORT_TEXT:
            return _text(question, _NAMES)
        case QuestionType.LONG_TEXT:
            return _text(question, _SENTENCES)
        case QuestionType.EMAIL:
            return f"{random.choice(_NAMES).lower().replace(' ', '.')}@example.com"
        case QuestionType.NUMBER:
            return _number(props)
        case QuestionType.RATING:
            return random.randint(1, props["max"])
        case QuestionType.YES_NO:
            return random.random() < 0.6
        case QuestionType.DROPDOWN:
            return random.choice(props["options"])["id"]
        case QuestionType.MULTIPLE_CHOICE:
            ids = [o["id"] for o in props["options"]]
            if props.get("allow_multiple"):
                return random.sample(ids, random.randint(1, len(ids)))
            return random.choice(ids)


def create_test_response(db, form: Form) -> Response:
    if not form.questions:
        raise BadRequestError("Add a question before generating a test response.")
    answers = {str(q.id): _answer(q) for q in form.questions}
    cleaned = validate_answers(form.questions, answers)
    now = utcnow()
    response = Response(
        form_id=form.id,
        status=ResponseStatus.COMPLETED,
        # A believable fill time, so "Time to complete" has something to show.
        started_at=now - timedelta(seconds=random.randint(25, 150)),
        submitted_at=now,
        meta={"test": True},
        answers=[Answer(question_id=qid, value=value) for qid, value in cleaned.items()],
    )
    db.add(response)
    db.commit()
    return response
