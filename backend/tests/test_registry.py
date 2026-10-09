"""The question-type registry (app/question_types): one spec per type, all per-type behavior in one place."""

import random
import re
from pathlib import Path

import pytest

from app.models import QuestionType
from app.question_types import SPECS, get_spec

NUMBER_OPS = {"eq", "neq", "lt", "lte", "gt", "gte"}
TEXT_OPS = {"is", "is_not", "contains"}
# The branching conditions each type offers. A new type adds its row here, so its ops are pinned by a test.
EXPECTED_OPS = {
    "multiple_choice": {"is", "is_not"},
    "picture_choice": {"is", "is_not"},
    "dropdown": {"is", "is_not"},
    "yes_no": {"is"},
    "number": NUMBER_OPS,
    "rating": NUMBER_OPS,
    "short_text": TEXT_OPS,
    "long_text": TEXT_OPS,
    "email": TEXT_OPS,
    "website": TEXT_OPS,
    "phone_number": TEXT_OPS,
    "date": {"is", "is_not", "lt", "lte", "gt", "gte"},
    "legal": {"is"},
    "checkbox": {"is"},
    "opinion_scale": NUMBER_OPS,
    "nps": NUMBER_OPS,
    "contact_info": set(),
    "address": set(),
    "ranking": {"is", "is_not"},
    "matrix": set(),
    "group": set(),
}
CHOICE_PROPS = {"options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}], "allow_multiple": True}

ANSWERABLE = [t for t in QuestionType if t in SPECS and SPECS[t].answerable]


def test_every_type_has_a_spec() -> None:
    assert set(SPECS) == set(QuestionType)


@pytest.mark.parametrize("qtype", ANSWERABLE)
def test_samples_validate_against_their_own_spec(qtype: QuestionType) -> None:
    spec = get_spec(qtype)
    props = spec.defaults()
    for seed in range(20):
        spec.validate(spec.sample(props, random.Random(seed)), props)  # must not raise


@pytest.mark.parametrize("qtype", ANSWERABLE)
def test_format_returns_non_empty_text(qtype: QuestionType) -> None:
    spec = get_spec(qtype)
    props = spec.defaults()
    text = spec.format(spec.sample(props, random.Random(3)), props)
    assert isinstance(text, str) and text != ""


@pytest.mark.parametrize("qtype", ANSWERABLE)
def test_logic_ops_are_unchanged(qtype: QuestionType) -> None:
    assert set(get_spec(qtype).logic_ops) == EXPECTED_OPS[qtype.value]


@pytest.mark.parametrize(
    ("qtype", "op", "expected", "answer", "props", "result"),
    [
        ("multiple_choice", "is", "a", ["a", "b"], CHOICE_PROPS, True),
        ("multiple_choice", "is_not", "a", ["b"], CHOICE_PROPS, True),
        ("dropdown", "is", "a", "b", CHOICE_PROPS, False),
        ("yes_no", "is", True, True, {}, True),
        ("yes_no", "is", True, False, {}, False),
        ("number", "gt", 5, 6, {}, True),
        ("rating", "lte", 3, 4, {"max": 5}, False),
        ("rating", "eq", 3, "x", {"max": 5}, False),
        ("short_text", "contains", "bc", "ABCD", {}, True),
        ("email", "is", "A@B.C", "a@b.c", {}, True),
    ],
)
def test_logic_match_keeps_its_behaviour(qtype, op, expected, answer, props, result) -> None:
    assert get_spec(qtype).logic_match(op, expected, answer, props) is result


def test_get_spec_rejects_an_unknown_type() -> None:
    with pytest.raises(ValueError):
        get_spec("nope")


def test_frontend_question_types_match_the_backend() -> None:
    """Drift guard: frontend/lib/types.ts lists the same types as the QuestionType enum."""
    source = (Path(__file__).parents[2] / "frontend" / "lib" / "types.ts").read_text(encoding="utf-8")
    block = re.search(r"export const QUESTION_TYPES = \[(.*?)\] as const;", source, re.S)
    assert block, "QUESTION_TYPES not found in frontend/lib/types.ts"
    assert set(re.findall(r'"([a-z_]+)"', block.group(1))) == {t.value for t in QuestionType}
