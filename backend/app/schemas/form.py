from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import FormStatus
from app.schemas.common import HexColor, PatchModel, StrictModel, Title
from app.schemas.question import QuestionOut

FORM_DESCRIPTION_MAX = 2000


class Theme(StrictModel):
    # Typeform's current default: monochrome (light canvas, ink text and buttons).
    background: HexColor = "#FAFAFA"
    text_color: HexColor = "#2A222B"
    button_color: HexColor = "#2A222B"
    font: str = Field(default="Inter", min_length=1, max_length=64)


class ThankYou(StrictModel):
    title: str = Field(default="Thanks for completing this form", max_length=200)
    message: str = Field(default="Your response has been recorded.", max_length=1000)
    button_text: str | None = Field(default=None, max_length=50)
    button_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://")


class FormCreate(StrictModel):
    title: Title = "Untitled form"


class FormUpdate(PatchModel):
    NON_NULLABLE = ("title", "theme", "thank_you")

    title: Title | None = None
    description: str | None = Field(default=None, max_length=FORM_DESCRIPTION_MAX)
    theme: Theme | None = None
    thank_you: ThankYou | None = None


class _FormBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    slug: str
    title: str
    status: FormStatus
    response_count: int
    created_at: datetime
    updated_at: datetime
    published_at: datetime | None


class FormListItem(_FormBase):
    question_count: int
    # Drawn as the form's icon / card thumbnail in the workspace, in the form's own colors.
    theme: Theme
    # Every response, partial included (response_count is completed only): completion = response_count / this.
    response_total: int


class FormOut(_FormBase):
    description: str | None
    theme: Theme
    thank_you: ThankYou
    questions: list[QuestionOut]
