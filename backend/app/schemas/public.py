from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import QuestionType
from app.schemas.common import StrictModel
from app.schemas.form import ThankYou, Theme


class PublicQuestion(BaseModel):
    """A question as respondents see it: no form id, position or logic."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: QuestionType
    title: str
    description: str | None
    required: bool
    properties: dict[str, Any]


class PublicForm(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    description: str | None
    theme: Theme
    thank_you: ThankYou
    # Ordered by position (relationship order_by).
    questions: list[PublicQuestion]


class SubmissionIn(StrictModel):
    # Keyed by question id (JSON object keys are strings); values are checked per type in services/validation.py.
    answers: dict[str, Any]


class SubmissionOut(BaseModel):
    id: int
