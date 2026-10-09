"""Logic v2: the rules stored in `questions.logic`, plus the form-level pieces they refer to
(variables, URL parameters, the outcome quiz). Mirrored by `Logic v2` in frontend/lib/types.ts.

```
{"version": 2,
 "branch": {"rules": [{"to": Target, "when": {"match": "all" | "any", "conditions": [Condition, ...]}}],
            "otherwise": Target | null},
 "calc":   [{"op": "add" | "subtract" | "multiply" | "divide", "value": {"number": 5} | {"variable": "score"},
             "variable": "score", "when": {...}}]}
```

A condition reads a question's answer, a form variable or a URL parameter; a target is a later question, an ending or the
built-in "Default end". These models check the shape only; whether the referenced questions, endings and variables exist
(and sit in the right place) needs the form and is checked by services/logic_check.py.
Spec: docs/superpowers/specs/2026-10-09-phase3-logic-design.md.
"""

import math
import re
from typing import Any, Literal

from pydantic import (
    Field,
    StrictInt,
    StrictStr,
    ValidationError,
    field_validator,
    model_serializer,
    model_validator,
)

from app.core.errors import errors_from_pydantic
from app.question_types.base import RULE_TEXT_MAX, is_number
from app.schemas.common import StrictModel

MAX_BRANCH_RULES = 20
MAX_CALC_RULES = 20
MAX_CONDITIONS = 10
# Largest number a calculation may add, subtract, multiply or divide by.
CALC_NUMBER_LIMIT = 1_000_000

VARIABLE_NAME_RE = re.compile(r"^[a-z][a-z0-9_]{0,39}$")
PARAM_NAME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_]{0,39}$")
# Typeform lists these as variables that need a Payment question; they cannot be created here.
RESERVED_VARIABLES = frozenset({"price", "segment"})
SCORE = "score"
MAX_CUSTOM_VARIABLES = 20
VARIABLE_TEXT_MAX = 200
MAX_URL_PARAMETERS = 30
MAX_OUTCOME_ENTRIES = 50
# Question types whose answers the outcome quiz can count.
OUTCOME_QUESTION_TYPES = frozenset({"multiple_choice", "picture_choice", "dropdown"})

LogicOp = Literal["is", "is_not", "contains", "eq", "neq", "lt", "lte", "gt", "gte"]
CalcOp = Literal["add", "subtract", "multiply", "divide"]
NUMBER_OPS = frozenset({"eq", "neq", "lt", "lte", "gt", "gte"})
TEXT_OPS = frozenset({"is", "is_not", "contains"})


class _OneOf(StrictModel):
    """A `{"a": 1}` style object where exactly one optional key is present; unset keys are left out when dumped."""

    @model_serializer(mode="wrap")
    def _without_unset(self, handler):
        return {key: value for key, value in handler(self).items() if value is not None}

    def _check_exactly_one(self, message: str) -> None:
        if sum(getattr(self, name) is not None for name in type(self).model_fields) != 1:
            raise ValueError(message)


class ConditionSource(_OneOf):
    question: StrictInt | None = None
    variable: StrictStr | None = None
    param: StrictStr | None = None

    @model_validator(mode="after")
    def _one(self):
        self._check_exactly_one("Choose a question, a variable or a URL parameter")
        return self


class Target(_OneOf):
    question: StrictInt | None = None
    ending: StrictInt | None = None
    end: Literal[True] | None = None

    @model_validator(mode="after")
    def _one(self):
        self._check_exactly_one("Choose a question, an ending or Default end")
        return self


class CalcValue(_OneOf):
    number: int | float | None = None
    variable: StrictStr | None = None

    @field_validator("number", mode="before")
    @classmethod
    def _number(cls, v: Any) -> Any:
        if v is not None and not is_number(v):
            raise ValueError("Enter a number")
        return v

    @field_validator("number")
    @classmethod
    def _in_range(cls, v: float | None) -> float | None:
        if v is not None and (not math.isfinite(v) or abs(v) > CALC_NUMBER_LIMIT):
            raise ValueError(f"Enter a number between -{CALC_NUMBER_LIMIT:,} and {CALC_NUMBER_LIMIT:,}")
        return v

    @model_validator(mode="after")
    def _one(self):
        self._check_exactly_one("Enter a number or choose a variable")
        return self


class Condition(StrictModel):
    source: ConditionSource
    op: LogicOp
    # Option id (choice), bool (yes/no), number (number/rating/number variable) or text; checked per source later.
    value: bool | int | float | str

    # A plain validator instead of coercion: "1" stays text, and one readable error comes back.
    @field_validator("value", mode="before")
    @classmethod
    def _scalar(cls, v: Any) -> Any:
        if not isinstance(v, bool | int | float | str) or (isinstance(v, float) and not math.isfinite(v)):
            raise ValueError("Enter a value")
        return v


class ConditionSet(StrictModel):
    match: Literal["all", "any"]
    conditions: list[Condition] = Field(min_length=1, max_length=MAX_CONDITIONS)


class BranchRule(StrictModel):
    to: Target
    when: ConditionSet


class Branch(StrictModel):
    rules: list[BranchRule] = Field(default_factory=list, max_length=MAX_BRANCH_RULES)
    # "All other cases go to"; null = the next question.
    otherwise: Target | None = None


class CalcRule(StrictModel):
    op: CalcOp
    value: CalcValue
    variable: StrictStr
    when: ConditionSet


class Logic(StrictModel):
    version: Literal[2]
    branch: Branch = Field(default_factory=Branch)
    calc: list[CalcRule] = Field(default_factory=list, max_length=MAX_CALC_RULES)

    @property
    def is_empty(self) -> bool:
        return not (self.branch.rules or self.branch.otherwise or self.calc)


class OutcomeEntry(StrictModel):
    """Outcome quiz: choosing this answer adds one point to the ending that holds the entry."""

    question: StrictInt
    choice: StrictStr = Field(min_length=1, max_length=200)


class FormVariable(StrictModel):
    name: str = Field(pattern=VARIABLE_NAME_RE.pattern)
    type: Literal["number", "text"]
    initial: int | float | str

    @field_validator("initial", mode="before")
    @classmethod
    def _plain(cls, v: Any) -> Any:
        if not isinstance(v, int | float | str) or isinstance(v, bool):
            raise ValueError("Enter a number or some text")
        return v

    @model_validator(mode="after")
    def _initial_matches_type(self):
        if self.type == "number":
            if isinstance(self.initial, str) or not math.isfinite(self.initial):
                raise ValueError("Enter a number")
        elif not isinstance(self.initial, str):
            raise ValueError("Enter some text")
        elif len(self.initial) > VARIABLE_TEXT_MAX:
            raise ValueError(f"Keep it under {VARIABLE_TEXT_MAX} characters")
        return self


def default_variables() -> list[dict[str, Any]]:
    return [{"name": SCORE, "type": "number", "initial": 0}]


def check_variables(raw: list[Any], prefix: str = "variables") -> tuple[list[dict[str, Any]] | None, dict[str, str]]:
    """Validates a form's whole variable list. Returns (clean list, {}) or (None, errors keyed like `variables.1.name`)."""
    errors: dict[str, str] = {}
    clean: list[FormVariable] = []
    for i, item in enumerate(raw):
        try:
            clean.append(FormVariable.model_validate(item))
        except ValidationError as exc:
            errors.update(errors_from_pydantic(exc, prefix=f"{prefix}.{i}"))
    if errors:
        return None, errors

    seen: set[str] = set()
    for i, variable in enumerate(clean):
        if variable.name in RESERVED_VARIABLES:
            errors[f"{prefix}.{i}.name"] = "This variable needs a Payment question"
        elif variable.name in seen:
            errors[f"{prefix}.{i}.name"] = "Variable names must be unique"
        seen.add(variable.name)
    score = next((i for i, v in enumerate(clean) if v.name == SCORE), None)
    if score is None:
        errors[prefix] = f'The "{SCORE}" variable is required'
    elif clean[score].type != "number":
        errors[f"{prefix}.{score}.type"] = f'"{SCORE}" must be a number'
    if len(clean) - (score is not None) > MAX_CUSTOM_VARIABLES:
        errors[prefix] = f"You can add up to {MAX_CUSTOM_VARIABLES} variables"
    if errors:
        return None, errors
    return [v.model_dump() for v in clean], {}


def check_url_parameters(raw: list[str], prefix: str = "url_parameters") -> tuple[list[str] | None, dict[str, str]]:
    """Validates the enabled URL parameter names (predefined ones are ordinary names too)."""
    errors: dict[str, str] = {}
    seen: set[str] = set()
    for i, name in enumerate(raw):
        if not isinstance(name, str) or not PARAM_NAME_RE.match(name):
            errors[f"{prefix}.{i}"] = "Use letters, digits and underscores, starting with a letter (40 characters at most)"
        elif name in seen:
            errors[f"{prefix}.{i}"] = "Parameter names must be unique"
        else:
            seen.add(name)
    if len(raw) > MAX_URL_PARAMETERS:
        errors[prefix] = f"You can pull in up to {MAX_URL_PARAMETERS} URL parameters"
    return (None, errors) if errors else (list(raw), {})


def text_value_error(value: Any) -> str | None:
    """A text value for a text variable or URL parameter condition."""
    if not isinstance(value, str) or not value.strip():
        return "Enter some text"
    return None if len(value) <= RULE_TEXT_MAX else f"Keep it under {RULE_TEXT_MAX} characters"

