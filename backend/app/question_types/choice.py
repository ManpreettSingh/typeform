"""Multiple choice, dropdown, yes/no, legal and checkbox."""

import random
from collections import defaultdict
from datetime import datetime
from typing import Any

from app.models import Question, QuestionType
from app.question_types.base import AnswerError, Properties, QuestionTypeSpec
from app.schemas.properties import (
    CheckboxProperties,
    ChoiceOption,
    DropdownProperties,
    EmptyProperties,
    MultipleChoiceProperties,
    new_option_id,
)
from app.schemas.response import ChoiceSummary, OptionCount

YES_NO_OPTIONS = [("yes", "Yes"), ("no", "No")]
LEGAL_OPTIONS = [("accepted", "Accepted"), ("declined", "Declined")]
CHECKBOX_OPTIONS = [("checked", "Checked")]
# Typeform's default error texts for a required consent that wasn't given.
LEGAL_REQUIRED = "Please agree to the terms & conditions"
CHECKBOX_REQUIRED = "Oops! Please make a selection"
_CHOICE_OPS = frozenset({"is", "is_not"})


def _option_ids(props: Properties) -> list[str]:
    return [option["id"] for option in props["options"]]


def _validate_multiple_choice(value: Any, props: Properties) -> str | list[str]:
    ids = _option_ids(props)
    if not props.get("allow_multiple"):
        if isinstance(value, list):
            raise AnswerError("Please choose one option")
        if value not in ids:
            raise AnswerError("Please choose from the options")
        return value
    if not isinstance(value, list) or not all(isinstance(v, str) and v in ids for v in value):
        raise AnswerError("Please choose from the options")
    if len(set(value)) != len(value):
        raise AnswerError("Please choose each option only once")
    # Stored in the creator's option order, whatever order they were picked in.
    return [option_id for option_id in ids if option_id in value]


def _validate_dropdown(value: Any, props: Properties) -> str:
    if not isinstance(value, str) or value not in _option_ids(props):
        raise AnswerError("Please choose from the list")
    return value


def _validate_yes_no(value: Any, _props: Properties) -> bool:
    if not isinstance(value, bool):
        raise AnswerError("Please choose Yes or No")
    return value


def _validate_legal(value: Any, _props: Properties) -> bool:
    if not isinstance(value, bool):
        raise AnswerError("Please choose I accept or I don’t accept")
    return value


def _validate_checkbox(value: Any, _props: Properties) -> bool:
    if not isinstance(value, bool):
        raise AnswerError("Please tick the box or leave it empty")
    return value


def _format_choice(value: Any, props: Properties) -> str:
    labels = {o["id"]: o["label"] or "(untitled choice)" for o in props["options"]}
    ids = value if isinstance(value, list) else [value]
    return "; ".join(labels.get(i, "(removed choice)") for i in ids)


def _format_yes_no(value: Any, _props: Properties) -> str:
    return "Yes" if value else "No"


def _format_legal(value: Any, _props: Properties) -> str:
    return "Accepted" if value else "Declined"


def _format_checkbox(value: Any, _props: Properties) -> str:
    return "Checked" if value else "Unchecked"


def _summarize_choice(question: Question, values: list[Any], _times: list[datetime]) -> ChoiceSummary:
    qtype = QuestionType(question.type)
    if qtype == QuestionType.YES_NO:
        options = YES_NO_OPTIONS
        picked = [["yes" if v else "no"] for v in values]
    else:
        options = [(o["id"], o["label"]) for o in question.properties["options"]]
        picked = [v if isinstance(v, list) else [v] for v in values]

    counts: dict[str, int] = defaultdict(int)
    for ids in picked:
        for option_id in ids:
            counts[option_id] += 1
    # Answers naming options the creator has since removed aren't listed.
    return ChoiceSummary(
        question_id=question.id,
        type=qtype,
        title=question.title,
        answered=len(values),
        counts=[OptionCount(option_id=oid, label=label, count=counts[oid]) for oid, label in options],
    )


def _summarize_consent(question: Question, values: list[Any], _times: list[datetime]) -> ChoiceSummary:
    """Legal: accepted and declined; checkbox: the ticks (an untouched box is a skipped question)."""
    qtype = QuestionType(question.type)
    ticked = sum(1 for v in values if v is True)
    counts = {"accepted": ticked, "declined": len(values) - ticked, "checked": ticked}
    options = LEGAL_OPTIONS if qtype == QuestionType.LEGAL else CHECKBOX_OPTIONS
    return ChoiceSummary(
        question_id=question.id,
        type=qtype,
        title=question.title,
        answered=len(values),
        counts=[OptionCount(option_id=oid, label=label, count=counts[oid]) for oid, label in options],
    )


def _sample_multiple_choice(props: Properties, rng: random.Random) -> str | list[str]:
    ids = _option_ids(props)
    if props.get("allow_multiple"):
        return rng.sample(ids, rng.randint(1, len(ids)))
    return rng.choice(ids)


def _sample_dropdown(props: Properties, rng: random.Random) -> str:
    return rng.choice(props["options"])["id"]


def _sample_yes_no(_props: Properties, rng: random.Random) -> bool:
    return rng.random() < 0.6


def _sample_consent(_props: Properties, _rng: random.Random) -> bool:
    # Always given: a generated test response must also pass when the question is required.
    return True


def _match_choice(op: str, expected: Any, value: Any, _props: Properties) -> bool:
    picked = value if isinstance(value, list) else [value]
    return (expected in picked) == (op == "is")


def _match_yes_no(_op: str, expected: Any, value: Any, _props: Properties) -> bool:
    return value is expected


def _choice_rule_error(value: Any) -> str | None:
    return None if isinstance(value, str) and value else "Choose an option"


def _yes_no_rule_error(value: Any) -> str | None:
    return None if isinstance(value, bool) else "Choose Yes or No"


def _legal_rule_error(value: Any) -> str | None:
    return None if isinstance(value, bool) else "Choose Accepted or Declined"


def _checkbox_rule_error(value: Any) -> str | None:
    # An untouched box is a skipped question and skipped questions match no rule, so only "checked" can be tested.
    return None if value is True else "Choose Checked"


def _is_true(value: Any) -> bool:
    return value is True


def _two_default_options() -> list[ChoiceOption]:
    return [ChoiceOption(id=new_option_id(), label=f"Choice {i}") for i in (1, 2)]


def _convert_choice(old_type: QuestionType, old_props: Properties) -> dict:
    if old_type in (QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN):
        return {"options": old_props.get("options", _two_default_options())}
    return {"options": _two_default_options()}

SPECS = [
    QuestionTypeSpec(
        key=QuestionType.MULTIPLE_CHOICE,
        properties_model=MultipleChoiceProperties,
        answerable=True,
        defaults=lambda: MultipleChoiceProperties(options=_two_default_options()).model_dump(exclude_none=True),
        validate=_validate_multiple_choice,
        format=_format_choice,
        summarize=_summarize_choice,
        sample=_sample_multiple_choice,
        logic_ops=_CHOICE_OPS,
        logic_match=_match_choice,
        logic_value_error=_choice_rule_error,
        convert=_convert_choice,
    ),
    QuestionTypeSpec(
        key=QuestionType.DROPDOWN,
        properties_model=DropdownProperties,
        answerable=True,
        defaults=lambda: DropdownProperties(options=_two_default_options()).model_dump(exclude_none=True),
        validate=_validate_dropdown,
        format=_format_choice,
        summarize=_summarize_choice,
        sample=_sample_dropdown,
        logic_ops=_CHOICE_OPS,
        logic_match=_match_choice,
        logic_value_error=_choice_rule_error,
        convert=_convert_choice,
    ),
    QuestionTypeSpec(
        key=QuestionType.YES_NO,
        properties_model=EmptyProperties,
        answerable=True,
        defaults=lambda: EmptyProperties().model_dump(exclude_none=True),
        validate=_validate_yes_no,
        format=_format_yes_no,
        summarize=_summarize_choice,
        sample=_sample_yes_no,
        logic_ops=frozenset({"is"}),
        logic_match=_match_yes_no,
        logic_value_error=_yes_no_rule_error,
    ),
    QuestionTypeSpec(
        key=QuestionType.LEGAL,
        properties_model=EmptyProperties,
        answerable=True,
        defaults=lambda: EmptyProperties().model_dump(exclude_none=True),
        validate=_validate_legal,
        format=_format_legal,
        summarize=_summarize_consent,
        sample=_sample_consent,
        logic_ops=frozenset({"is"}),
        logic_match=_match_yes_no,
        logic_value_error=_legal_rule_error,
        required_message=LEGAL_REQUIRED,
        satisfies_required=_is_true,
    ),
    QuestionTypeSpec(
        key=QuestionType.CHECKBOX,
        properties_model=CheckboxProperties,
        answerable=True,
        defaults=lambda: CheckboxProperties().model_dump(exclude_none=True),
        validate=_validate_checkbox,
        format=_format_checkbox,
        summarize=_summarize_consent,
        sample=_sample_consent,
        logic_ops=frozenset({"is"}),
        logic_match=_match_yes_no,
        logic_value_error=_checkbox_rule_error,
        required_message=CHECKBOX_REQUIRED,
        satisfies_required=_is_true,
    ),
]
