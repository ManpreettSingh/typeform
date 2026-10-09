"""Legal, checkbox, opinion scale and NPS question types."""

import random
from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.core.errors import FieldValidationError
from app.models import Question, QuestionType
from app.question_types import AnswerError, get_spec
from app.schemas.logic import Logic, rule_errors
from app.schemas.properties import default_properties, validate_properties
from app.services.validation import validate_answers

# Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
AGREE = "Please agree to the terms & conditions"
SELECT = "Oops! Please make a selection"
FILL_IN = "Please fill this in"
NOW = datetime(2026, 10, 9, tzinfo=UTC)


def question(qtype: str, *, required: bool = False, **props) -> Question:
    spec = get_spec(qtype)
    return Question(id=1, type=qtype, title="Q", required=required, properties={**spec.defaults(), **props})


def errors_for(q: Question, answers: dict, **kwargs) -> dict:
    with pytest.raises(FieldValidationError) as error:
        validate_answers([q], answers, **kwargs)
    return error.value.errors


def validate(qtype: str, value, **props):
    spec = get_spec(qtype)
    return spec.validate(value, {**spec.defaults(), **props})


def summary(q: Question, values: list):
    return get_spec(q.type).summarize(q, values, [NOW] * len(values))


# ---- legal -----------------------------------------------------------------


def test_legal_accepts_either_answer_when_optional() -> None:
    q = question("legal")
    assert validate_answers([q], {"1": True}) == {1: True}
    assert validate_answers([q], {"1": False}) == {1: False}


def test_legal_required_rejects_false() -> None:
    q = question("legal", required=True)
    assert errors_for(q, {"1": False}) == {"1": AGREE}
    assert validate_answers([q], {"1": True}) == {1: True}


def test_legal_required_says_to_agree_when_nothing_was_chosen() -> None:
    q = question("legal", required=True)
    assert errors_for(q, {}) == {"1": AGREE}
    assert errors_for(q, {"1": None}) == {"1": AGREE}


def test_legal_progress_saves_keep_a_declined_answer() -> None:
    q = question("legal", required=True)
    assert validate_answers([q], {"1": False}, partial=True) == {1: False}
    assert validate_answers([q], {}, partial=True) == {}


@pytest.mark.parametrize("value", ["yes", "true", 1, 0, ["I accept"]])
def test_legal_and_checkbox_only_take_true_or_false(value) -> None:
    for qtype in ("legal", "checkbox"):
        with pytest.raises(AnswerError):
            validate(qtype, value)


def test_legal_has_no_properties() -> None:
    assert default_properties(QuestionType.LEGAL) == {}
    with pytest.raises(ValidationError):
        validate_properties(QuestionType.LEGAL, {"label": "x"})


def test_legal_summary_counts_accepted_and_declined() -> None:
    result = summary(question("legal"), [True, True, False])
    assert result.answered == 3
    assert [(c.option_id, c.label, c.count) for c in result.counts] == [("accepted", "Accepted", 2), ("declined", "Declined", 1)]


def test_legal_text_in_results_and_csv() -> None:
    spec = get_spec("legal")
    assert (spec.format(True, {}), spec.format(False, {})) == ("Accepted", "Declined")


# ---- checkbox --------------------------------------------------------------


def test_checkbox_label_defaults_to_empty_and_is_capped() -> None:
    assert default_properties(QuestionType.CHECKBOX) == {"label": ""}
    assert validate_properties(QuestionType.CHECKBOX, {"label": "I agree to the terms"}) == {"label": "I agree to the terms"}
    with pytest.raises(ValidationError):
        validate_properties(QuestionType.CHECKBOX, {"label": "x" * 501})
    with pytest.raises(ValidationError):
        validate_properties(QuestionType.CHECKBOX, {"label": "x", "other": 1})


def test_checkbox_required_needs_a_tick() -> None:
    q = question("checkbox", required=True)
    assert errors_for(q, {"1": False}) == {"1": SELECT}
    assert errors_for(q, {}) == {"1": SELECT}
    assert validate_answers([q], {"1": True}) == {1: True}


def test_checkbox_optional_may_stay_unticked() -> None:
    q = question("checkbox")
    assert validate_answers([q], {}) == {}


def test_checkbox_summary_counts_the_ticks() -> None:
    result = summary(question("checkbox"), [True, True, True])
    assert result.answered == 3
    assert [(c.option_id, c.label, c.count) for c in result.counts] == [("checked", "Checked", 3)]


def test_checkbox_text_in_results_and_csv() -> None:
    spec = get_spec("checkbox")
    assert (spec.format(True, {"label": ""}), spec.format(False, {"label": ""})) == ("Checked", "Unchecked")


def test_sampled_consent_is_always_given() -> None:
    """A generated test response must pass validation even when the consent question is required."""
    for qtype in ("legal", "checkbox"):
        spec = get_spec(qtype)
        assert all(spec.sample(spec.defaults(), random.Random(seed)) is True for seed in range(20))


# ---- opinion scale ---------------------------------------------------------


def test_opinion_scale_defaults() -> None:
    assert default_properties(QuestionType.OPINION_SCALE) == {
        "steps": 10,
        "start_at_one": True,
        "labels": {"left": "", "center": "", "right": ""},
    }


@pytest.mark.parametrize(
    ("props", "accepted", "rejected"),
    [
        ({}, [1, 5, 10], [0, 11, -1]),
        ({"steps": 11, "start_at_one": False}, [0, 5, 10], [-1, 11]),
        ({"steps": 5, "start_at_one": True}, [1, 5], [0, 6]),
        ({"steps": 5, "start_at_one": False}, [0, 4], [5, -1]),
        ({"steps": 11, "start_at_one": True}, [1, 11], [0, 12]),
    ],
)
def test_opinion_scale_range_follows_start_and_steps(props, accepted, rejected) -> None:
    for value in accepted:
        assert validate("opinion_scale", value, **props) == value
    for value in rejected:
        with pytest.raises(AnswerError, match="Please choose a rating"):
            validate("opinion_scale", value, **props)


@pytest.mark.parametrize("value", [4.5, "5", True, False, None, [5]])
def test_opinion_scale_and_nps_only_take_whole_numbers(value) -> None:
    for qtype in ("opinion_scale", "nps"):
        with pytest.raises(AnswerError):
            validate(qtype, value)


def test_opinion_scale_properties_are_checked() -> None:
    for bad in ({"steps": 4}, {"steps": 12}, {"start_at_one": "maybe"}, {"labels": {"left": "x" * 81}}, {"labels": {"top": "x"}}, {"zoom": 1}):
        with pytest.raises(ValidationError):
            validate_properties(QuestionType.OPINION_SCALE, bad)
    good = {"steps": 7, "start_at_one": False, "labels": {"left": "Never", "center": "Sometimes", "right": "Always"}}
    assert validate_properties(QuestionType.OPINION_SCALE, good) == good


def test_opinion_scale_summary_lists_every_step() -> None:
    result = summary(question("opinion_scale"), [10, 10, 3])
    assert (result.answered, result.min, result.max, result.average) == (3, 1, 10, 7.67)
    assert list(result.distribution) == [str(n) for n in range(1, 11)]
    assert (result.distribution["10"], result.distribution["3"], result.distribution["1"]) == (2, 1, 0)


def test_opinion_scale_summary_starting_at_zero() -> None:
    result = summary(question("opinion_scale", steps=11, start_at_one=False), [0, 10])
    assert (result.min, result.max) == (0, 10)
    assert list(result.distribution) == [str(n) for n in range(0, 11)]


def test_opinion_scale_summary_survives_a_narrowed_range() -> None:
    """Answers outside a since-edited range still count toward the average, not the distribution."""
    result = summary(question("opinion_scale", steps=5), [9, 2])
    assert result.average == 5.5
    assert sum(result.distribution.values()) == 1


# ---- nps -------------------------------------------------------------------


def test_nps_default_labels() -> None:
    assert default_properties(QuestionType.NPS) == {
        "labels": {"left": "Not at all likely", "center": "", "right": "Extremely likely"}
    }


@pytest.mark.parametrize("value", [0, 3, 6, 7, 8, 9, 10])
def test_nps_accepts_zero_to_ten(value: int) -> None:
    assert validate("nps", value) == value


@pytest.mark.parametrize("value", [11, -1, 100])
def test_nps_rejects_11(value: int) -> None:
    with pytest.raises(AnswerError, match="Please choose a rating"):
        validate("nps", value)


def test_nps_summary_score() -> None:
    result = summary(question("nps"), [10, 9, 8, 3])
    assert result.answered == 4
    assert (result.promoters.count, result.promoters.percent) == (2, 50)
    assert (result.passives.count, result.passives.percent) == (1, 25)
    assert (result.detractors.count, result.detractors.percent) == (1, 25)
    assert result.score == 25
    assert list(result.distribution) == [str(n) for n in range(0, 11)]
    assert (result.distribution["10"], result.distribution["9"], result.distribution["3"], result.distribution["0"]) == (1, 1, 1, 0)


def test_nps_score_extremes_and_rounding() -> None:
    assert summary(question("nps"), [0, 6, 2]).score == -100
    assert summary(question("nps"), [9, 10]).score == 100
    # 1 promoter, 2 passives, 0 detractors → 33.3% → 33
    assert summary(question("nps"), [10, 7, 8]).score == 33


def test_nps_summary_without_answers() -> None:
    result = summary(question("nps"), [])
    assert (result.answered, result.score, result.average) == (0, None, None)
    assert (result.promoters.count, result.promoters.percent) == (0, 0)


def test_nps_boundaries_between_the_groups() -> None:
    result = summary(question("nps"), [6, 7, 8, 9])
    assert (result.detractors.count, result.passives.count, result.promoters.count) == (1, 2, 1)


def test_nps_labels_are_checked() -> None:
    with pytest.raises(ValidationError):
        validate_properties(QuestionType.NPS, {"labels": {"left": "x" * 81}})
    with pytest.raises(ValidationError):
        validate_properties(QuestionType.NPS, {"steps": 5})


# ---- branching ---------------------------------------------------------------


def test_branching_on_the_new_types() -> None:
    legal = get_spec("legal")
    assert legal.logic_match("is", True, True, {}) and not legal.logic_match("is", True, False, {})
    checkbox = get_spec("checkbox")
    assert checkbox.logic_match("is", True, True, {}) and not checkbox.logic_match("is", True, False, {})
    nps = get_spec("nps")
    assert nps.logic_match("lte", 6, 0, {}) and not nps.logic_match("lte", 6, 7, {})
    scale = get_spec("opinion_scale")
    assert scale.logic_match("gte", 8, 8, {}) and not scale.logic_match("gt", 8, 8, {})


def test_branching_rules_take_the_right_kind_of_value() -> None:
    def errors(qtype: QuestionType, op: str, value) -> dict:
        return rule_errors(qtype, Logic.model_validate({"rules": [{"op": op, "value": value, "to": "end"}]}))

    assert errors(QuestionType.LEGAL, "is", True) == {}
    assert errors(QuestionType.LEGAL, "is", "yes") != {}
    assert errors(QuestionType.LEGAL, "is_not", True) != {}
    assert errors(QuestionType.CHECKBOX, "is", True) == {}
    # An untouched box is a skipped question and skipped questions match no rule, so "unchecked" can't be tested.
    assert errors(QuestionType.CHECKBOX, "is", False) != {}
    assert errors(QuestionType.NPS, "lt", 7) == {}
    assert errors(QuestionType.NPS, "lt", "7") != {}
    assert errors(QuestionType.OPINION_SCALE, "contains", 3) != {}
