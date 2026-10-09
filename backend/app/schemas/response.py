from datetime import datetime
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import QuestionType, ResponseStatus

DEFAULT_PAGE_SIZE = 20
MAX_PAGE_SIZE = 100


class _ResponseBase(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    status: ResponseStatus
    started_at: datetime
    submitted_at: datetime | None


class ResponseListItem(_ResponseBase):
    # Keyed by question id (JSON object keys are strings); unanswered questions are absent.
    answers: dict[int, Any]


class ResponsePage(BaseModel):
    items: list[ResponseListItem]
    total: int
    page: int
    page_size: int


class ResponseAnswer(BaseModel):
    question_id: int
    question_title: str
    question_type: QuestionType
    value: Any


class ResponseDetail(_ResponseBase):
    # In question order; unanswered questions are absent.
    answers: list[ResponseAnswer]


# ---- Summary (GET /forms/{id}/summary) ------------------------------------


class _QuestionSummaryBase(BaseModel):
    question_id: int
    title: str
    # Completed responses that answered this question.
    answered: int


class OptionCount(BaseModel):
    option_id: str
    label: str
    count: int


class ChoiceSummary(_QuestionSummaryBase):
    type: Literal[
        QuestionType.MULTIPLE_CHOICE,
        QuestionType.DROPDOWN,
        QuestionType.YES_NO,
        QuestionType.LEGAL,
        QuestionType.CHECKBOX,
    ]
    # In option order. Multi-select counts can sum to more than `answered`.
    counts: list[OptionCount]


class RatingSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.RATING]
    max: int
    average: float | None
    # "1".."max" → count, every step present.
    distribution: dict[str, int]


class ScaleSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.OPINION_SCALE]
    # The scale's first and last step as it is configured now.
    min: int
    max: int
    average: float | None
    # "min".."max" → count, every step present.
    distribution: dict[str, int]


class NpsGroup(BaseModel):
    count: int
    # Share of the answers, 0–100 with one decimal.
    percent: float


class NpsSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.NPS]
    average: float | None
    # "0".."10" → count, every step present.
    distribution: dict[str, int]
    promoters: NpsGroup  # 9–10
    passives: NpsGroup  # 7–8
    detractors: NpsGroup  # 0–6
    # Net Promoter Score: % promoters − % detractors as a whole number (−100…100); None without answers.
    score: int | None


class NumberSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.NUMBER]
    min: float | None
    max: float | None
    average: float | None


class TextAnswer(BaseModel):
    value: str
    submitted_at: datetime


class TextSummary(_QuestionSummaryBase):
    type: Literal[
        QuestionType.SHORT_TEXT,
        QuestionType.LONG_TEXT,
        QuestionType.EMAIL,
        QuestionType.WEBSITE,
        QuestionType.PHONE_NUMBER,
        QuestionType.DATE,
    ]
    # Every answer, most recent first (Typeform lists them all, with a search box).
    answers: list[TextAnswer]

class CompositeSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.CONTACT_INFO, QuestionType.ADDRESS]
    answers: list[TextAnswer]


class RankAverage(BaseModel):
    option_id: str
    label: str
    average: float


class RankingSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.RANKING]
    # In option order, dict of option_id -> RankAverage
    ranks: dict[str, RankAverage]


class MatrixSummary(_QuestionSummaryBase):
    type: Literal[QuestionType.MATRIX]
    # dict of row_id -> ChoiceSummary
    rows: dict[str, ChoiceSummary]


QuestionSummary = Annotated[
    ChoiceSummary | RatingSummary | ScaleSummary | NpsSummary | NumberSummary | TextSummary | CompositeSummary | RankingSummary | MatrixSummary,
    Field(discriminator="type"),
]


class FormSummary(BaseModel):
    # Every response, partial included.
    total_responses: int
    completed: int
    # completed / total_responses; 0 when there are no responses.
    completion_rate: float
    # Form performance: times the public form was opened ("Views"; starts = total_responses).
    views: int
    # Average seconds from start to submission over completed responses that were timed; null if none.
    average_seconds: float | None
    # In question order; stats cover completed responses only.
    questions: list[QuestionSummary]
