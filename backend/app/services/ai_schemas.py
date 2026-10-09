"""Shapes of the Typeform AI chat: the request bodies, the proposed form ("proposal") and the diff shown for review.

A proposal is the whole form as it would look after the change (welcome, every question in order, every ending), not a
list of edits. Items that already exist carry their `id`; new ones have `id` null. That makes restoring an earlier
version, previewing and applying trivial: the server only has to compare the proposal with the saved form.
"""

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

from app.models.enums import QuestionType
from app.schemas.common import StrictModel
from app.schemas.question import QUESTION_DESCRIPTION_MAX, QUESTION_TITLE_MAX

MEMORY_MAX = 2000
MESSAGE_MAX = 4000
MAX_MESSAGES = 40
MAX_QUESTIONS = 100
MAX_ENDINGS = 20


class ChatMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MESSAGE_MAX)


class ProposalWelcome(StrictModel):
    """The form's title and welcome screen (`forms.title`, `forms.description`, `forms.welcome`)."""

    title: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    button_text: str = Field(default="Start", max_length=24)
    show_time_to_complete: bool = False
    show_submission_count: bool = False


class ProposalQuestion(StrictModel):
    id: int | None = None
    type: QuestionType
    title: str = Field(default="", max_length=QUESTION_TITLE_MAX)
    description: str | None = Field(default=None, max_length=QUESTION_DESCRIPTION_MAX)
    required: bool = False
    # Complete, validated properties of the type (the same object a manual edit would save).
    properties: dict[str, Any] = Field(default_factory=dict)
    # Informational: the group header this question sits under. Groups are never changed by the AI.
    group_id: int | None = None


class ProposalEnding(StrictModel):
    id: int | None = None
    title: str = Field(default="Thanks for completing this form", max_length=200)
    message: str = Field(default="Your response has been recorded.", max_length=1000)
    button_text: str | None = Field(default=None, max_length=50)
    button_url: str | None = Field(default=None, max_length=2000, pattern=r"^https?://")


class Proposal(StrictModel):
    welcome: ProposalWelcome
    questions: list[ProposalQuestion] = Field(default_factory=list, max_length=MAX_QUESTIONS)
    endings: list[ProposalEnding] = Field(min_length=1, max_length=MAX_ENDINGS)


# ---- Diff ---------------------------------------------------------------------------------------------------------


class QuestionSummary(BaseModel):
    id: int | None
    type: QuestionType
    title: str
    # 0-based place in the saved form (to_remove) or in the proposal (to_set).
    position: int


class QuestionChange(QuestionSummary):
    # "changed" wins over "moved" when both apply; `moved` says whether the order changed as well.
    change: Literal["new", "changed", "moved"]
    # What differs from the saved question: "title", "description", "required" or a property name ("options").
    fields: list[str] = Field(default_factory=list)
    moved: bool = False


class EndingSummary(BaseModel):
    id: int | None
    title: str
    position: int


class EndingChange(EndingSummary):
    change: Literal["new", "changed", "moved"]
    fields: list[str] = Field(default_factory=list)
    moved: bool = False


class EndingsDiff(BaseModel):
    to_remove: list[EndingSummary] = Field(default_factory=list)
    to_set: list[EndingChange] = Field(default_factory=list)


class Diff(BaseModel):
    to_remove: list[QuestionSummary] = Field(default_factory=list)
    to_set: list[QuestionChange] = Field(default_factory=list)
    endings: EndingsDiff = Field(default_factory=EndingsDiff)
    # Names of the welcome fields that differ ("title", "description", "button_text", …).
    welcome: list[str] = Field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not (self.to_remove or self.to_set or self.endings.to_remove or self.endings.to_set or self.welcome)


# ---- Requests and responses ---------------------------------------------------------------------------------------


class ChatIn(StrictModel):
    # The form being edited; null → the AI drafts a brand-new form (applying creates it).
    form_id: int | None = None
    messages: list[ChatMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    # The proposal the creator is reviewing right now (so the next message builds on it); null → the saved form.
    draft: Proposal | None = None
    # Overrides the stored memory for this call (an unsaved edit); null → use what is stored.
    memory: str | None = Field(default=None, max_length=MEMORY_MAX)

    @model_validator(mode="after")
    def _ends_with_the_creator(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must be the creator's")
        return self


class ChatOut(BaseModel):
    reply: str
    # The whole form as proposed, or null when this turn changed nothing (a question, a refusal).
    proposal: Proposal | None
    diff: Diff | None


class ApplyIn(StrictModel):
    form_id: int | None = None
    proposal: Proposal


class MemoryIn(StrictModel):
    content: str = Field(max_length=MEMORY_MAX)


class MemoryOut(BaseModel):
    content: str
    max_length: int = MEMORY_MAX
