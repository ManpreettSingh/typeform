"""Resolves which question comes next (branching). Mirrored by frontend/lib/logic.ts.

Only forward jumps are followed: a rule whose target is missing or not after the current question is
skipped. That keeps every path finite (no cycles) even after the creator reorders questions.
"""

from collections.abc import Sequence
from typing import Any

from app.models import Question, QuestionType


def _number(value: Any) -> float | None:
    return value if isinstance(value, int | float) and not isinstance(value, bool) else None


def rule_matches(qtype: str, rule: dict[str, Any], value: Any) -> bool:
    """Whether `rule` applies to the validated answer `value`. Unanswered questions (None) match no rule."""
    if value is None or value == "" or value == []:
        return False
    op, expected = rule["op"], rule["value"]

    if qtype in (QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN):
        picked = value if isinstance(value, list) else [value]
        return (expected in picked) == (op == "is")
    if qtype == QuestionType.YES_NO:
        return value is expected
    if qtype in (QuestionType.NUMBER, QuestionType.RATING):
        a, b = _number(value), _number(expected)
        if a is None or b is None:
            return False
        return {"eq": a == b, "neq": a != b, "lt": a < b, "lte": a <= b, "gt": a > b, "gte": a >= b}.get(op, False)

    a, b = str(value).strip().casefold(), str(expected).strip().casefold()
    return {"is": a == b, "is_not": a != b, "contains": b in a}.get(op, False)


def next_index(questions: Sequence[Question], index: int, answers: dict[int, Any]) -> int | None:
    """Index of the question after `questions[index]`, or None for the end.

    `answers` maps question id → validated value; unanswered questions are absent.
    """
    question = questions[index]
    rules = (question.logic or {}).get("rules", [])
    if rules:
        positions = {q.id: i for i, q in enumerate(questions)}
        for rule in rules:
            if not rule_matches(question.type, rule, answers.get(question.id)):
                continue
            if rule["to"] == "end":
                return None
            target = positions.get(rule["to"])
            if target is not None and target > index:
                return target
    return index + 1 if index + 1 < len(questions) else None


def visited_path(questions: Sequence[Question], answers: dict[int, Any]) -> list[int]:
    """Indices a respondent with these answers goes through, from the first question to the end."""
    path: list[int] = []
    index = 0 if questions else None
    while index is not None:
        path.append(index)
        index = next_index(questions, index, answers)
    return path
