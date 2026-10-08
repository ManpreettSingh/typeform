"""Seeds demo data. Idempotent: forms are keyed by fixed slugs and skipped if present;
demo responses are only added to a seeded form that has none.

Run from backend/:  python -m app.seed
"""

from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.db import Base, SessionLocal, engine
from app.models import Answer, Form, FormStatus, Question, QuestionType, Response, ResponseStatus
from app.models.base import utcnow
from app.schemas.form import ThankYou, Theme
from app.schemas.properties import validate_properties

QuestionSpec = tuple[QuestionType, str, bool, dict[str, Any]]
# (status, days ago, one value per question in position order; None = unanswered)
ResponseSpec = tuple[ResponseStatus, float, list[Any]]

COMPLETED, PARTIAL = ResponseStatus.COMPLETED, ResponseStatus.PARTIAL

SEED_FORMS: list[dict[str, Any]] = [
    {
        "slug": "demo-feedback",
        "title": "Customer feedback",
        "description": "Help us improve — it takes less than a minute.",
        "questions": [
            (QuestionType.SHORT_TEXT, "What's your name?", True, {"placeholder": "Type your answer here..."}),
            (QuestionType.RATING, "How would you rate your experience?", True, {"max": 5, "shape": "star"}),
            (
                QuestionType.MULTIPLE_CHOICE,
                "Which features do you use most?",
                False,
                {
                    "options": [
                        {"id": "builder", "label": "Form builder"},
                        {"id": "sharing", "label": "Sharing"},
                        {"id": "results", "label": "Results"},
                    ],
                    "allow_multiple": True,
                },
            ),
            (QuestionType.LONG_TEXT, "Anything else you'd like to tell us?", False, {}),
        ],
        "responses": [
            (COMPLETED, 9, ["Priya", 5, ["builder", "results"], "Love the keyboard shortcuts."]),
            (COMPLETED, 8, ["Marco", 4, ["builder"], None]),
            (COMPLETED, 7, ["Aiko", 5, ["builder", "sharing", "results"], "Would love file uploads."]),
            (COMPLETED, 6, ["Sam", 3, ["sharing"], "The share link was easy to find."]),
            (COMPLETED, 5, ["Lena", 4, None, None]),
            (COMPLETED, 4, ["Tomás", 2, ["results"], "Charts could be bigger."]),
            (COMPLETED, 3, ["Grace", 5, ["builder", "sharing"], None]),
            (COMPLETED, 1.5, ["Omar", 4, ["builder", "results"], "Great experience overall!"]),
            (PARTIAL, 1, ["Jo", 4, None, None]),
            (PARTIAL, 0.5, ["Ravi", None, None, None]),
        ],
    },
]


def _seed_form(db: Session, spec: dict[str, Any]) -> Form | None:
    """Creates the form unless its slug exists; returns the new form or None."""
    if db.scalar(select(Form.id).where(Form.slug == spec["slug"])) is not None:
        return None
    questions: list[QuestionSpec] = spec["questions"]
    form = Form(
        slug=spec["slug"],
        title=spec["title"],
        description=spec["description"],
        status=FormStatus.PUBLISHED,
        published_at=utcnow(),
        theme=Theme().model_dump(),
        thank_you=ThankYou().model_dump(),
        questions=[
            Question(
                type=qtype,
                title=title,
                required=required,
                position=position,
                properties=validate_properties(qtype, props),
            )
            for position, (qtype, title, required, props) in enumerate(questions)
        ],
    )
    db.add(form)
    db.flush()
    return form


def _seed_responses(db: Session, form: Form, specs: list[ResponseSpec]) -> int:
    """Adds demo responses, but only to a form that has none (never mixes with real data)."""
    if db.scalar(select(func.count(Response.id)).where(Response.form_id == form.id)):
        return 0
    now = utcnow()
    for status, days_ago, values in specs:
        db.add(
            Response(
                form_id=form.id,
                status=status,
                started_at=now - timedelta(days=days_ago, minutes=3),
                submitted_at=now - timedelta(days=days_ago) if status == COMPLETED else None,
                answers=[
                    Answer(question_id=q.id, value=value)
                    for q, value in zip(form.questions, values, strict=True)
                    if value is not None
                ],
            )
        )
    return len(specs)


def seed() -> tuple[int, int]:
    """Returns (forms created, responses created)."""
    Base.metadata.create_all(engine)
    forms = responses = 0
    with SessionLocal() as db:
        for spec in SEED_FORMS:
            form = _seed_form(db, spec)
            forms += form is not None
            form = form or db.scalar(select(Form).where(Form.slug == spec["slug"]))
            responses += _seed_responses(db, form, spec.get("responses", []))
        db.commit()
    return forms, responses


if __name__ == "__main__":
    forms, responses = seed()
    print(f"Seeded {forms} new form(s) and {responses} response(s).")
