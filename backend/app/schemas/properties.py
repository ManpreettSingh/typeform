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
    none_of_the_above: bool = False
    randomize: bool = False
    min_selections: int | None = None
    max_selections: int | None = None

    @model_validator(mode="after")
    def _validate(self):
        _check_unique_option_ids(self.options)
        if not self.allow_multiple:
            if self.min_selections is not None or self.max_selections is not None:
                raise ValueError("min_selections and max_selections require allow_multiple")
        else:
            mi, ma = self.min_selections, self.max_selections
            num_opts = len(self.options)
            if mi is not None and mi < 1:
                raise ValueError("min_selections must be at least 1")
            if ma is not None and mi is not None and ma < mi:
                raise ValueError("max_selections cannot be less than min_selections")
            if ma is not None and ma > num_opts:
                raise ValueError("max_selections cannot exceed number of options")
        return self


class DropdownProperties(_Props):
    options: list[ChoiceOption] = Field(min_length=1, max_length=500)
    alphabetical: bool = False
    randomize: bool = False

    @model_validator(mode="after")
    def _unique_ids(self):
        _check_unique_option_ids(self.options)
        return self


class RatingProperties(_Props):
    max: int = Field(default=5, ge=3, le=10)
    shape: Literal[
        "star", "heart", "crown", "cat", "dog", "droplet", "flag", 
        "lightbulb", "pencil", "skull", "thunderbolt", "tick", 
        "trophy", "up", "user", "circle", "cloud", "number"
    ] = "star"


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


class StatementProperties(_Props):
    button_text: str = Field(default="Continue", max_length=24)
    hide_marks: bool = False

class GroupProperties(_Props):
    button_text: str = Field(default="Continue", max_length=24)


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


class CompositeField(_Props):
    key: str = Field(max_length=64)
    label: str = Field(max_length=200)
    enabled: bool
    required: bool


class ContactInfoProperties(_Props):
    fields: list[CompositeField] = Field(
        default_factory=lambda: [
            CompositeField(key="first_name", label="First name", enabled=True, required=False),
            CompositeField(key="last_name", label="Last name", enabled=True, required=False),
            CompositeField(key="phone_number", label="Phone number", enabled=True, required=False),
            CompositeField(key="email", label="Email", enabled=True, required=True),
            CompositeField(key="company", label="Company", enabled=True, required=False),
        ]
    )


class AddressProperties(_Props):
    fields: list[CompositeField] = Field(
        default_factory=lambda: [
            CompositeField(key="address", label="Address", enabled=True, required=True),
            CompositeField(key="address2", label="Address 2", enabled=True, required=False),
            CompositeField(key="city", label="City/Town", enabled=True, required=True),
            CompositeField(key="state", label="State/Region/Province", enabled=True, required=True),
            CompositeField(key="zip", label="Zip/Post code", enabled=True, required=True),
            CompositeField(key="country", label="Country", enabled=True, required=True),
        ]
    )


class RankingProperties(_Props):
    options: list[ChoiceOption] = Field(min_length=2, max_length=50)
    randomize: bool = False

    @model_validator(mode="after")
    def _unique_ids(self):
        _check_unique_option_ids(self.options)
        return self


class MatrixProperties(_Props):
    rows: list[ChoiceOption] = Field(min_length=1, max_length=50)
    columns: list[ChoiceOption] = Field(min_length=1, max_length=50)
    multiple_selection: bool = False

    @model_validator(mode="after")
    def _unique_ids(self):
        _check_unique_option_ids(self.rows)
        _check_unique_option_ids(self.columns)
        return self


def new_option_id() -> str:
    return secrets.token_hex(4)


def default_properties(qtype: QuestionType) -> dict[str, Any]:
    from app.question_types import get_spec  # imported here: the registry imports this module's models

    return get_spec(qtype).defaults()


def validate_properties(qtype: QuestionType, data: dict[str, Any]) -> dict[str, Any]:
    """Validates and normalises `data` for `qtype`. Raises pydantic.ValidationError."""
    from app.question_types import get_spec

    return get_spec(qtype).properties_model.model_validate(data).model_dump(exclude_none=True)
