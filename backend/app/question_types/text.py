"""Text-like answers: short text, long text, email, website and phone number."""

import random
import re
from datetime import datetime
from typing import Any

import phonenumbers
from pydantic import BaseModel

from app.models import Question, QuestionType
from app.question_types.base import RULE_TEXT_MAX, AnswerError, Properties, QuestionTypeSpec
from app.schemas.properties import EmptyProperties, PhoneProperties, TextProperties
from app.schemas.response import TextAnswer, TextSummary

# RFC-lite: something@something.tld, no spaces.
EMAIL_RE = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
# Upper bound for text answers whose question sets no max_length.
TEXT_ANSWER_MAX = 10_000

_NAMES = ["Alex Morgan", "Priya Shah", "Sam Lee", "Jordan Diaz", "Maya Chen", "Chris Novak", "Aisha Bello"]
_SENTENCES = [
    "Really smooth experience overall.",
    "It took me a moment to find the settings, but after that everything was clear.",
    "Great support team, they answered within minutes.",
    "I'd love to see more templates.",
    "Nothing to add, thanks!",
]
_TEXT_OPS = frozenset({"is", "is_not", "contains"})

# Typeform's default error texts for these two types.
WEBSITE_ERROR = "Hmm… that web address doesn’t look right. Check for any typos or errors."
PHONE_ERROR = "Hmm... that phone number doesn't look right"
WEBSITE_MAX = 2000
# http(s) only, scheme optional ("example.com" is fine), a dotted host with a real top-level label, no spaces.
_WEBSITE_RE = re.compile(
    r"^(?:https?://)?(?:[^\s/?#:@.]+\.)+[^\s/?#:@.]{2,}(?::\d{1,5})?(?:[/?#]\S*)?$", re.IGNORECASE
)
_SAMPLE_SITES = ["https://example.com", "https://www.example.org/about", "example.net"]
_SAMPLE_PHONES = ["+12015550123", "+14155552671", "+442079460958", "+919876543210"]


def _validate_text(value: Any, props: Properties) -> str:
    if not isinstance(value, str):
        raise AnswerError("Please enter some text")
    text = value.strip()
    limit = props.get("max_length") or TEXT_ANSWER_MAX
    if len(text) > limit:
        raise AnswerError(f"Please keep it under {limit} characters")
    return text


def _validate_email(value: Any, _props: Properties) -> str:
    if not isinstance(value, str) or not EMAIL_RE.match(value.strip()):
        raise AnswerError("Hmm… that email doesn't look right")
    return value.strip()


def _format(value: Any, _props: Properties) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _summarize(question: Question, values: list[Any], times: list[datetime]) -> TextSummary:
    return TextSummary(
        question_id=question.id,
        type=QuestionType(question.type),
        title=question.title,
        answered=len(values),
        answers=[TextAnswer(value=str(v), submitted_at=t) for v, t in zip(values, times, strict=True)],
    )


def _sample_from(pool: list[str]):
    def sample(props: Properties, rng: random.Random) -> str:
        value = rng.choice(pool)
        limit = props.get("max_length")
        return value[:limit] if limit else value

    return sample


def _sample_email(_props: Properties, rng: random.Random) -> str:
    return f"{rng.choice(_NAMES).lower().replace(' ', '.')}@example.com"


def _match(op: str, expected: Any, value: Any, _props: Properties) -> bool:
    a, b = str(value).strip().casefold(), str(expected).strip().casefold()
    return {"is": a == b, "is_not": a != b, "contains": b in a}.get(op, False)


def _rule_error(value: Any) -> str | None:
    if not isinstance(value, str) or not value.strip():
        return "Enter some text"
    return None if len(value) <= RULE_TEXT_MAX else f"Keep it under {RULE_TEXT_MAX} characters"


def _validate_website(value: Any, _props: Properties) -> str:
    text = value.strip() if isinstance(value, str) else ""
    if not text or len(text) > WEBSITE_MAX or not _WEBSITE_RE.match(text):
        raise AnswerError(WEBSITE_ERROR)
    return text


def _validate_phone(value: Any, props: Properties) -> str:
    if not isinstance(value, str):
        raise AnswerError(PHONE_ERROR)
    text = value.strip()
    # A leading "+" carries its own country code; anything else is read in the question's default country.
    region = None if text.startswith("+") else props.get("default_country", "US")
    try:
        number = phonenumbers.parse(text, region)
    except phonenumbers.NumberParseException as exc:
        raise AnswerError(PHONE_ERROR) from exc
    if not phonenumbers.is_valid_number(number):
        raise AnswerError(PHONE_ERROR)
    return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)


def _format_phone(value: Any, _props: Properties) -> str:
    try:
        return phonenumbers.format_number(phonenumbers.parse(str(value), None), phonenumbers.PhoneNumberFormat.INTERNATIONAL)
    except phonenumbers.NumberParseException:
        return str(value)  # stored before a rule changed: show it as it is


def _sample_website(_props: Properties, rng: random.Random) -> str:
    return rng.choice(_SAMPLE_SITES)


def _sample_phone(_props: Properties, rng: random.Random) -> str:
    return rng.choice(_SAMPLE_PHONES)


def _spec(key: QuestionType, model: type[BaseModel], validate, sample, format=_format) -> QuestionTypeSpec:
    return QuestionTypeSpec(
        key=key,
        properties_model=model,
        answerable=True,
        defaults=lambda: model().model_dump(exclude_none=True),
        validate=validate,
        format=format,
        summarize=_summarize,
        sample=sample,
        logic_ops=_TEXT_OPS,
        logic_match=_match,
        logic_value_error=_rule_error,
    )


SPECS = [
    _spec(QuestionType.SHORT_TEXT, TextProperties, _validate_text, _sample_from(_NAMES)),
    _spec(QuestionType.LONG_TEXT, TextProperties, _validate_text, _sample_from(_SENTENCES)),
    _spec(QuestionType.EMAIL, EmptyProperties, _validate_email, _sample_email),
    _spec(QuestionType.WEBSITE, EmptyProperties, _validate_website, _sample_website),
    _spec(QuestionType.PHONE_NUMBER, PhoneProperties, _validate_phone, _sample_phone, _format_phone),
]
