import pytest
from app.models.enums import QuestionType
from app.question_types import get_spec
from app.question_types.base import AnswerError
from app.schemas.properties import ContactInfoProperties, AddressProperties, CompositeField

def test_contact_info_requires_only_flagged_fields():
    spec = get_spec(QuestionType.CONTACT_INFO)
    props = spec.defaults()
    # Mark email as required, company as not required
    for f in props["fields"]:
        if f["key"] == "email":
            f["required"] = True
            f["enabled"] = True
        elif f["key"] == "company":
            f["required"] = False
            f["enabled"] = True

    # Missing required field
    with pytest.raises(AnswerError) as excinfo:
        spec.validate({"company": "Acme Corp"}, props)
    assert "email" in str(excinfo.value)
    
    # Missing optional field is fine
    val = spec.validate({"email": "test@example.com"}, props)
    assert val == {"email": "test@example.com"}

def test_contact_info_rejects_bad_email_inside():
    spec = get_spec(QuestionType.CONTACT_INFO)
    props = spec.defaults()
    for f in props["fields"]:
        if f["key"] == "email":
            f["enabled"] = True
            
    with pytest.raises(AnswerError) as excinfo:
        spec.validate({"email": "not-an-email"}, props)
    # The error should be dict with key 'email' and value being the email error
    assert "email" in str(excinfo.value)

def test_address_drops_empty_optional_fields():
    spec = get_spec(QuestionType.ADDRESS)
    props = spec.defaults()
    # All enabled, none required
    for f in props["fields"]:
        f["enabled"] = True
        f["required"] = False
        
    val = spec.validate({"city": "New York", "zip": "", "country": "  "}, props)
    assert val == {"city": "New York"}

def test_composite_summary_lists_answers():
    spec = get_spec(QuestionType.CONTACT_INFO)
    # create a mock question and answers
    class MockQuestion:
        id = 1
        type = QuestionType.CONTACT_INFO
        title = "Test"
        properties = spec.defaults()
        
    answers = [
        {"first_name": "Alice", "company": "Acme"},
        {"email": "bob@example.com", "first_name": "Bob"}
    ]
    from datetime import datetime
    dates = [datetime.utcnow(), datetime.utcnow()]
    
    summary = spec.summarize(MockQuestion(), answers, dates)
    assert summary.answered == 2
    assert len(summary.answers) == 2
    # Check that answers are formatted
    assert "Alice" in summary.answers[0].value
    assert "Acme" in summary.answers[0].value

def test_removed_field_ignored_in_csv():
    # format should ignore fields not in properties
    spec = get_spec(QuestionType.CONTACT_INFO)
    props = spec.defaults()
    # disable all fields
    for f in props["fields"]:
        f["enabled"] = False
        
    # An old answer had first_name
    formatted = spec.format({"first_name": "Alice", "old_field": "discarded"}, props)
    assert "Alice" not in formatted
    assert "discarded" not in formatted
