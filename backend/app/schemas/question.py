from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuestionType
from app.schemas.common import PatchModel, StrictModel

QUESTION_TITLE_MAX = 1000
QUESTION_DESCRIPTION_MAX = 2000


class QuestionCreate(StrictModel):
    type: QuestionType
    # Empty by default: the builder shows a placeholder until the creator types a title.
    title: str = Field(default="", max_length=QUESTION_TITLE_MAX)
    description: str | None = Field(default=None, max_length=QUESTION_DESCRIPTION_MAX)
    required: bool = False
    # Omitted → type defaults; otherwise validated against `type` (schemas/properties.py).
    properties: dict[str, Any] | None = None
    # Omitted → appended at the end. Values past the end are clamped.
    position: int | None = Field(default=None, ge=0)


class QuestionUpdate(PatchModel):
    NON_NULLABLE = ("title", "required", "properties")

    title: str | None = Field(default=None, max_length=QUESTION_TITLE_MAX)
    description: str | None = Field(default=None, max_length=QUESTION_DESCRIPTION_MAX)
    required: bool | None = None
    # Replaces the whole object; validated against the question's type.
    properties: dict[str, Any] | None = None
    # Branching rules (schemas/logic.py); replaces the whole object, null or no rules = none.
    logic: dict[str, Any] | None = None


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    form_id: int
    type: QuestionType
    title: str
    description: str | None
    required: bool
    position: int
    properties: dict[str, Any]
    logic: dict[str, Any] | None


class QuestionOrder(StrictModel):
    ordered_ids: list[int]
