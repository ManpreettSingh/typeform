"""Response shapes of the templates gallery (GET /api/templates, GET /api/templates/{slug})."""

from pydantic import BaseModel, ConfigDict

from app.models.enums import QuestionType
from app.schemas.form import Theme


class TemplateTagsOut(BaseModel):
    """Category slugs: role (sales, product, ...), goal (get-feedback, ...) and type (forms, surveys, quizzes, polls)."""

    role: list[str]
    goal: list[str]
    type: list[str]


class TemplateSummary(BaseModel):
    """One card of the gallery. `theme` carries the colors the thumbnail is drawn with."""

    model_config = ConfigDict(from_attributes=True)

    slug: str
    title: str
    description: str
    tags: TemplateTagsOut
    question_count: int
    # Distinct question types in first-use order: the chips on the card.
    question_types: list[QuestionType]
    theme_name: str
    theme: Theme


class TemplateQuestionPreview(BaseModel):
    type: QuestionType
    title: str
    description: str | None
    required: bool


class TemplateEndingPreview(BaseModel):
    title: str
    message: str


class TemplateDetail(TemplateSummary):
    """The "View template" dialog: every question and ending, in order."""

    questions: list[TemplateQuestionPreview]
    endings: list[TemplateEndingPreview]
