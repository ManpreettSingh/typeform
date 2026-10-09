"""Branching rules stored in `questions.logic` (DATABASE_SCHEMA.md "logic").

`{"rules": [{"op": "is", "value": "<option id>", "to": <question id> | "end"}]}`. Rules are checked in
order after the question is answered; the first match decides where to go, otherwise the next question.
Which ops and value types are allowed depends on the question type (OPS_BY_TYPE).
"""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import QuestionType
from app.question_types import SPECS

MAX_RULES = 20

LogicOp = Literal["is", "is_not", "contains", "eq", "neq", "lt", "lte", "gt", "gte"]

# Which conditions each type supports comes from its spec (app/question_types).
OPS_BY_TYPE: dict[QuestionType, frozenset[str]] = {t: s.logic_ops for t, s in SPECS.items() if s.answerable}


class LogicRule(BaseModel):
    model_config = ConfigDict(extra="forbid")

    op: LogicOp
    # Option id (choice/dropdown), bool (yes/no), number (number/rating) or text; checked per type below.
    value: bool | int | float | str
    # A question of the same form, or "end" to finish the form.
    to: int | Literal["end"]

    # Plain validators instead of union types: one readable error per field, and no coercion ("1" stays text).
    @field_validator("value", mode="before")
    @classmethod
    def _scalar(cls, v: Any) -> Any:
        if not isinstance(v, bool | int | float | str):
            raise ValueError("Enter a value")
        return v

    @field_validator("to", mode="before")
    @classmethod
    def _target(cls, v: Any) -> Any:
        if v != "end" and (not isinstance(v, int) or isinstance(v, bool)):
            raise ValueError('Must be a question id or "end"')
        return v


class Logic(BaseModel):
    model_config = ConfigDict(extra="forbid")

    rules: list[LogicRule] = Field(max_length=MAX_RULES)


def _value_error(qtype: QuestionType, value: Any) -> str | None:
    check = SPECS[qtype].logic_value_error
    return check(value) if check else None


def rule_errors(qtype: QuestionType, logic: Logic) -> dict[str, str]:
    """Type-specific problems keyed like `logic.rules.0.op`. Targets are checked by the caller (needs the form)."""
    if qtype not in OPS_BY_TYPE and logic.rules:
        return {"logic": "Rules cannot be added to this question type"}

    errors: dict[str, str] = {}
    for i, rule in enumerate(logic.rules):
        if rule.op not in OPS_BY_TYPE[qtype]:
            errors[f"logic.rules.{i}.op"] = "This condition isn't available for this question type"
        elif message := _value_error(qtype, rule.value):
            errors[f"logic.rules.{i}.value"] = message
    return errors
