from typing import Any

from pydantic import BaseModel, ConfigDict

from app.models.enums import QuestionType, ResponseStatus
from app.schemas.common import StrictModel
from app.schemas.form import ThankYou, Theme


class PublicQuestion(BaseModel):
    """A question as respondents see it: no form id or position. `logic` lets the client follow branches."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    type: QuestionType
    title: str
    description: str | None
    required: bool
    group_title: str | None = None
    group_id: int | None = None
    properties: dict[str, Any]
    logic: dict[str, Any] | None


from app.schemas.form import ThankYou, Theme, Welcome
from app.schemas.ending import EndingOut

class PublicForm(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    description: str | None
    theme: Theme
    thank_you: ThankYou
    welcome: Welcome
    submission_count: int | None = None
    questions: list[PublicQuestion]
    endings: list[EndingOut]


class SubmissionIn(StrictModel):
    # Keyed by question id (JSON object keys are strings); values are checked per type in services/validation.py.
    answers: dict[str, Any]


class SubmissionOut(BaseModel):
    id: int


class PartialStartOut(BaseModel):
    response_id: int
    # Needed to save progress on this response; keeps others from writing to it.
    token: str


class PartialUpdateIn(StrictModel):
    token: str
    # Replaces the stored answers (same shape as SubmissionIn.answers).
    answers: dict[str, Any]
    # true = final submission: full validation, response becomes completed.
    complete: bool = False


class PartialUpdateOut(BaseModel):
    id: int
    status: ResponseStatus
