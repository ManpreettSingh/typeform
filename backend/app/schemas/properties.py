"""Per-question-type `properties` models, defaults, and validation (DATABASE_SCHEMA.md)."""

import re
import secrets
from datetime import date
from typing import Any, Literal

import phonenumbers
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

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


class ScaleLabels(_Props):
    """Captions under the ends and the middle of a scale; any may be empty."""

    left: str = Field(default="", max_length=80)
    center: str = Field(default="", max_length=80)
    right: str = Field(default="", max_length=80)


class OpinionScaleProperties(_Props):
    # Typeform's "steps" (5 to 11); the scale runs from 1 (or 0) up for that many steps.
    steps: int = Field(default=10, ge=5, le=11)
    start_at_one: bool = True
    labels: ScaleLabels = Field(default_factory=ScaleLabels)


class NpsProperties(_Props):
    labels: ScaleLabels = Field(default_factory=lambda: ScaleLabels(left="Not at all likely", right="Extremely likely"))


class CheckboxProperties(_Props):
    # The text beside the box ("I agree to the terms"); the question title stays above it.
    label: str = Field(default="", max_length=500)


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


DateFormat = Literal["MMDDYYYY", "DDMMYYYY", "YYYYMMDD"]
DateSeparator = Literal["/", "-", "."]
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class DateProperties(_Props):
    format: DateFormat = "MMDDYYYY"
    separator: DateSeparator = "/"
    # ISO dates (YYYY-MM-DD) limiting what respondents may pick; either, both or neither.
    start_date: str | None = None
    end_date: str | None = None

    @field_validator("start_date", "end_date")
    @classmethod
    def _real_iso_date(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not _ISO_DATE.match(value):
            raise ValueError("Enter a date")
        try:
            date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("Enter a date") from exc
        return value

    @model_validator(mode="after")
    def _start_before_end(self):
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("The end date must be on or after the start date")
        return self


class PhoneProperties(_Props):
    # ISO 3166 alpha-2 region used to read numbers typed without a "+" country code.
    default_country: str = "US"

    @field_validator("default_country")
    @classmethod
    def _real_region(cls, value: str) -> str:
        code = value.strip().upper()
        if code not in phonenumbers.SUPPORTED_REGIONS:
            raise ValueError("Choose a country")
        return code


def new_option_id() -> str:
    return secrets.token_hex(4)


def default_properties(qtype: QuestionType) -> dict[str, Any]:
    from app.question_types import get_spec  # imported here: the registry imports this module's models

    return get_spec(qtype).defaults()


def validate_properties(qtype: QuestionType, data: dict[str, Any]) -> dict[str, Any]:
    """Validates and normalises `data` for `qtype`. Raises pydantic.ValidationError."""
    from app.question_types import get_spec

    return get_spec(qtype).properties_model.model_validate(data).model_dump(exclude_none=True)
