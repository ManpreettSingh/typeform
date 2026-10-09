import json
import phonenumbers
from typing import Any
from pydantic import TypeAdapter, ValidationError, EmailStr
from app.models.enums import QuestionType
from app.question_types.base import AnswerError, QuestionTypeSpec
from app.schemas.properties import ContactInfoProperties, AddressProperties
from app.question_types.text import EMAIL_RE
from app.schemas.response import QuestionSummary

def _validate_composite(value: Any, props: dict, email_fields: set, phone_fields: set) -> dict:
    if not isinstance(value, dict):
        raise AnswerError("Answer must be an object")
    
    out = {}
    errors = {}
    fields = props.get("fields", [])
    
    for f in fields:
        k = f["key"]
        if not f.get("enabled", True):
            continue
            
        v = value.get(k)
        if v is None or (isinstance(v, str) and not v.strip()):
            if f.get("required", False):
                errors[k] = "Please fill this in"
            continue
            
        v = str(v).strip()
        
        if k in email_fields:
            if not EMAIL_RE.match(v):
                errors[k] = "Hmm... that email doesn't look right"
                
        if k in phone_fields:
            try:
                parsed = phonenumbers.parse(v, None)
                if not phonenumbers.is_valid_number(parsed):
                    errors[k] = "Hmm... that phone number doesn't look right"
                v = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
            except phonenumbers.NumberParseException:
                errors[k] = "Hmm... that phone number doesn't look right"
                
        out[k] = v
        
    if errors:
        raise AnswerError(json.dumps(errors))
        
    if not out:
        # If all fields are empty and optional, validation succeeds, returning {}. But `validate_answers` might drop it if `is_empty` caught it. 
        # If is_empty returned False (e.g. if the dict had empty keys), returning an empty dict is fine.
        pass
        
    return out

def _validate_contact_info(value: Any, props: dict) -> dict:
    return _validate_composite(value, props, {"email"}, {"phone_number"})

def _validate_address(value: Any, props: dict) -> dict:
    return _validate_composite(value, props, set(), set())

def _format_composite(value: Any, props: dict) -> str:
    if not isinstance(value, dict):
        return ""
    fields = props.get("fields", [])
    parts = []
    for f in fields:
        if f.get("enabled", True):
            k = f["key"]
            if k in value and str(value[k]).strip():
                parts.append(str(value[k]).strip())
    return ", ".join(parts)

def _summarize_composite(question, answers: list[Any], dates) -> QuestionSummary:
    from app.schemas.response import CompositeSummary, TextAnswer
    formatted = []
    for ans, dt in zip(answers, dates, strict=False):
        fmt = _format_composite(ans, question.properties)
        if fmt:
            formatted.append(TextAnswer(value=fmt, submitted_at=dt))
    return CompositeSummary(
        question_id=question.id,
        type=question.type,
        title=question.title,
        answered=len(formatted),
        answers=formatted
    )

SPECS = [
    QuestionTypeSpec(
        key=QuestionType.CONTACT_INFO,
        properties_model=ContactInfoProperties,
        answerable=True,
        defaults=lambda: ContactInfoProperties().model_dump(exclude_none=True),
        validate=_validate_contact_info,
        format=_format_composite,
        summarize=_summarize_composite,
        sample=lambda p, r: {"email": "test@example.com", "phone_number": "+12015550123"},
        logic_ops=frozenset(),
        logic_match=None,
        logic_value_error=None,
    ),
    QuestionTypeSpec(
        key=QuestionType.ADDRESS,
        properties_model=AddressProperties,
        answerable=True,
        defaults=lambda: AddressProperties().model_dump(exclude_none=True),
        validate=_validate_address,
        format=_format_composite,
        summarize=_summarize_composite,
        sample=lambda p, r: {"address": "123 Main St", "city": "Anytown", "state": "CA", "zip": "90210", "country": "US"},
        logic_ops=frozenset(),
        logic_match=None,
        logic_value_error=None,
    ),
]
