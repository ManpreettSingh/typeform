"""Seeds demo data. Idempotent: forms are keyed by fixed slugs and skipped if present.

Run from backend/:  python -m app.seed
"""

from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.db import Base, SessionLocal, engine
from app.models import Form, FormStatus, Question, QuestionType
from app.models.base import utcnow
from app.schemas.form import ThankYou, Theme
from app.schemas.properties import validate_properties

QuestionSpec = tuple[QuestionType, str, bool, dict[str, Any]]

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
    },
]


def _seed_form(db: Session, spec: dict[str, Any]) -> bool:
    if db.scalar(select(Form.id).where(Form.slug == spec["slug"])) is not None:
        return False
    questions: list[QuestionSpec] = spec["questions"]
    db.add(
        Form(
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
    )
    return True


def seed() -> int:
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        created = sum(_seed_form(db, spec) for spec in SEED_FORMS)
        db.commit()
    return created


if __name__ == "__main__":
    print(f"Seeded {seed()} new form(s).")
