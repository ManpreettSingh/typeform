"""Per-question-type `properties` models, defaults, and validation (DATABASE_SCHEMA.md)."""

import secrets
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.models.enums import QuestionType


class _Props(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ChoiceOption(_Props):
    id: str = Field(min_length=1, max_length=64)
    # Empty labels are allowed so the builder can autosave a freshly added option.
    label: str = Field(max_length=500)


def _check_unique_option_ids(options: list[ChoiceOption]) -> None:
    ids = [o.id for o in options]
    if len(ids) != len(set(ids)):
        raise ValueError("option ids must be unique")


class MultipleChoiceProperties(_Props):
    options: list[ChoiceOption] = Field(min_length=1, max_length=50)
    allow_multiple: bool = False
    allow_other: bool = False

    @model_validator(mode="after")
    def _unique_ids(self):
        _check_unique_option_ids(self.options)
        return self


class DropdownProperties(_Props):
    options: list[ChoiceOption] = Field(min_length=1, max_length=500)

    @model_validator(mode="after")
    def _unique_ids(self):
        _check_unique_option_ids(self.options)
        return self


class RatingProperties(_Props):
    max: int = Field(default=5, ge=3, le=10)
    shape: Literal["star", "heart", "number"] = "star"


class NumberProperties(_Props):
    min: float | None = None
    max: float | None = None

    @model_validator(mode="after")
    def _min_le_max(self):
        if self.min is not None and self.max is not None and self.min > self.max:
            raise ValueError("min must be less than or equal to max")
        return self


class TextProperties(_Props):
    placeholder: str | None = Field(default=None, max_length=200)
    max_length: int | None = Field(default=None, ge=1, le=10_000)


class EmptyProperties(_Props):
    pass


PROPERTIES_MODELS: dict[QuestionType, type[_Props]] = {
    QuestionType.SHORT_TEXT: TextProperties,
    QuestionType.LONG_TEXT: TextProperties,
    QuestionType.MULTIPLE_CHOICE: MultipleChoiceProperties,
    QuestionType.DROPDOWN: DropdownProperties,
    QuestionType.EMAIL: EmptyProperties,
    QuestionType.NUMBER: NumberProperties,
    QuestionType.YES_NO: EmptyProperties,
    QuestionType.RATING: RatingProperties,
}


def new_option_id() -> str:
    return secrets.token_hex(4)


def default_properties(qtype: QuestionType) -> dict[str, Any]:
    if qtype in (QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN):
        options = [ChoiceOption(id=new_option_id(), label=f"Choice {i}") for i in (1, 2)]
        return PROPERTIES_MODELS[qtype](options=options).model_dump(exclude_none=True)
    return PROPERTIES_MODELS[qtype]().model_dump(exclude_none=True)


def validate_properties(qtype: QuestionType, data: dict[str, Any]) -> dict[str, Any]:
    """Validates and normalises `data` for `qtype`. Raises pydantic.ValidationError."""
    return PROPERTIES_MODELS[qtype].model_validate(data).model_dump(exclude_none=True)
