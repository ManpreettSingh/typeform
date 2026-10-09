"""Typeform's "Generate test response": a completed response with plausible random answers.

Every question gets an answer (made by its type's sample), then the normal validation keeps only the ones on the path
the answers take (branching), exactly like a real submission. Test rows are marked in `meta` so they can be told
apart later.
"""

import random
from datetime import timedelta

from app.core.errors import BadRequestError
from app.models import Answer, Form, Response, ResponseStatus
from app.models.base import utcnow
from app.question_types import get_spec
from app.services.validation import validate_answers


def create_test_response(db, form: Form) -> Response:
    if not form.questions:
        raise BadRequestError("Add a question before generating a test response.")
    rng = random.Random()
    answers = {str(q.id): get_spec(q.type).sample(q.properties, rng) for q in form.questions}
    cleaned = validate_answers(form.questions, answers)
    now = utcnow()
    response = Response(
        form_id=form.id,
        status=ResponseStatus.COMPLETED,
        # A believable fill time, so "Time to complete" has something to show.
        started_at=now - timedelta(seconds=rng.randint(25, 150)),
        submitted_at=now,
        meta={"test": True},
        answers=[Answer(question_id=qid, value=value) for qid, value in cleaned.items()],
    )
    db.add(response)
    db.commit()
    return response
