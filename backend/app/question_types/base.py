"""What every question type provides: one QuestionTypeSpec per type, collected in question_types/__init__.py.

Everything that depends on the type (properties, answer validation, display text, stats, sample answers, branching
conditions) lives in the type's spec, so adding a type means writing one spec and nothing else in the services.
"""

import random
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.models.enums import QuestionType
from app.models.question import Question
from app.schemas.response import QuestionSummary

Properties = dict[str, Any]

# Longest text a branching rule may compare against.
RULE_TEXT_MAX = 500


class AnswerError(ValueError):
    """A submitted answer that doesn't fit its question; the message is what the respondent sees."""


def is_number(value: Any) -> bool:
    # bool is an int subclass in Python; JSON true/false must not pass as numbers.
    return isinstance(value, int | float) and not isinstance(value, bool)


def average(numbers: list[float]) -> float | None:
    return round(sum(numbers) / len(numbers), 2) if numbers else None


@dataclass(frozen=True)
class QuestionTypeSpec:
    key: QuestionType
    properties_model: type[BaseModel]
    # False for blocks that take no answer (statement, group): they never appear in results, exports or logic sources.
    answerable: bool
    # Properties of a freshly added question.
    defaults: Callable[[], Properties]
    # (answer, properties) -> value to store; raises AnswerError. Callers handle empty answers first.
    validate: Callable[[Any, Properties], Any] | None = None
    # (stored value, properties) -> text for the results table, drawer and CSV.
    format: Callable[[Any, Properties], str] | None = None
    # (question, stored values newest first, their submission times) -> summary card data.
    summarize: Callable[[Question, list[Any], list[datetime]], QuestionSummary] | None = None
    # (properties, rng) -> a plausible valid answer (test responses, seed data).
    sample: Callable[[Properties, random.Random], Any] | None = None
    # Branching conditions this type supports, and how they are checked.
    logic_ops: frozenset[str] = frozenset()
    # (op, rule value, validated answer, properties) -> does the rule apply?
    logic_match: Callable[[str, Any, Any, Properties], bool] | None = None
    # rule value -> error message, or None when the value suits this type.
    logic_value_error: Callable[[Any], str | None] | None = None
    # (previous type, previous properties) -> properties for this type when a question changes type.
    convert: Callable[[QuestionType, Properties], Properties] | None = None
    # What a required question says when it is left unanswered; None → the common "Please fill this in".
    required_message: str | None = None
    # (validated value) -> False when the value doesn't answer a required question (e.g. "I don't accept").
    satisfies_required: Callable[[Any], bool] | None = None
