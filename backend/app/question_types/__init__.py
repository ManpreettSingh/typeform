"""The question-type registry: SPECS maps every QuestionType to its QuestionTypeSpec (see base.py)."""

from app.models.enums import QuestionType
from app.question_types import choice, dates, files, numeric, payment, structure, text, composite, matrix_ranking
from app.question_types.base import AnswerError, QuestionTypeSpec

SPECS: dict[QuestionType, QuestionTypeSpec] = {
    spec.key: spec
    for module in (text, numeric, choice, dates, structure, composite, matrix_ranking, files, payment)
    for spec in module.SPECS
}


def get_spec(qtype: str) -> QuestionTypeSpec:
    """The spec for a type name; raises ValueError for a name that isn't a QuestionType."""
    return SPECS[QuestionType(qtype)]


__all__ = ["SPECS", "AnswerError", "QuestionTypeSpec", "get_spec"]
