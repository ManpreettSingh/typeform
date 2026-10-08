import pytest

from app.core.errors import FieldValidationError
from app.models import Question, QuestionType
from app.services.validation import TEXT_ANSWER_MAX, AnswerError, validate_answer, validate_answers

CHOICES = {"options": [{"id": "a", "label": "A"}, {"id": "b", "label": "B"}, {"id": "c", "label": "C"}]}
SINGLE = {**CHOICES, "allow_multiple": False}
MULTI = {**CHOICES, "allow_multiple": True}
RATING = {"max": 5, "shape": "star"}
BAD_EMAIL = "Hmm… that email doesn't look right"


def q(qtype: QuestionType, properties: dict | None = None, *, id: int = 1, required: bool = False) -> Question:
    return Question(id=id, type=qtype, title="Q", required=required, properties=properties or {})


@pytest.mark.parametrize(
    ("question", "value", "expected"),
    [
        (q(QuestionType.SHORT_TEXT), "  hi  ", "hi"),
        (q(QuestionType.LONG_TEXT, {"max_length": 5}), "line\n", "line"),
        (q(QuestionType.EMAIL), " a@b.co ", "a@b.co"),
        (q(QuestionType.NUMBER, {"min": 0, "max": 10}), 10, 10),
        (q(QuestionType.NUMBER, {"min": -1.5}), -1.5, -1.5),
        (q(QuestionType.NUMBER), 0, 0),
        (q(QuestionType.RATING, RATING), 5, 5),
        (q(QuestionType.YES_NO), False, False),
        (q(QuestionType.MULTIPLE_CHOICE, SINGLE), "b", "b"),
        (q(QuestionType.MULTIPLE_CHOICE, MULTI), ["c", "a"], ["a", "c"]),
        (q(QuestionType.DROPDOWN, CHOICES), "c", "c"),
    ],
)
def test_valid_answers_are_normalised(question, value, expected):
    assert validate_answer(question, value) == expected


@pytest.mark.parametrize(
    ("question", "value", "message"),
    [
        (q(QuestionType.SHORT_TEXT), 12, "Please enter some text"),
        (q(QuestionType.SHORT_TEXT, {"max_length": 3}), "abcd", "Please keep it under 3 characters"),
        (q(QuestionType.LONG_TEXT), "x" * (TEXT_ANSWER_MAX + 1), f"Please keep it under {TEXT_ANSWER_MAX} characters"),
        (q(QuestionType.EMAIL), "not-an-email", BAD_EMAIL),
        (q(QuestionType.EMAIL), "a b@c.de", BAD_EMAIL),
        (q(QuestionType.NUMBER), "12", "Please enter a number"),
        (q(QuestionType.NUMBER), True, "Please enter a number"),
        (q(QuestionType.NUMBER), float("inf"), "Please enter a number"),
        (q(QuestionType.NUMBER, {"min": 5}), 4, "Please enter a number of 5 or more"),
        (q(QuestionType.NUMBER, {"max": 2.5}), 3, "Please enter a number of 2.5 or less"),
        (q(QuestionType.RATING, RATING), 0, "Please choose a rating"),
        (q(QuestionType.RATING, RATING), 6, "Please choose a rating"),
        (q(QuestionType.RATING, RATING), 4.5, "Please choose a rating"),
        (q(QuestionType.RATING, RATING), True, "Please choose a rating"),
        (q(QuestionType.YES_NO), "yes", "Please choose Yes or No"),
        (q(QuestionType.MULTIPLE_CHOICE, SINGLE), "z", "Please choose from the options"),
        (q(QuestionType.MULTIPLE_CHOICE, SINGLE), ["a", "b"], "Please choose one option"),
        (q(QuestionType.MULTIPLE_CHOICE, MULTI), "a", "Please choose from the options"),
        (q(QuestionType.MULTIPLE_CHOICE, MULTI), ["a", "z"], "Please choose from the options"),
        (q(QuestionType.MULTIPLE_CHOICE, MULTI), ["a", "a"], "Please choose each option only once"),
        (q(QuestionType.DROPDOWN, CHOICES), ["a"], "Please choose from the list"),
    ],
)
def test_invalid_answers_are_rejected(question, value, message):
    with pytest.raises(AnswerError) as exc:
        validate_answer(question, value)
    assert str(exc.value) == message


def test_validate_answers_collects_every_error():
    questions = [
        q(QuestionType.SHORT_TEXT, id=1, required=True),
        q(QuestionType.EMAIL, id=2),
        q(QuestionType.YES_NO, id=3),
    ]
    with pytest.raises(FieldValidationError) as exc:
        validate_answers(questions, {"1": "   ", "2": "nope", "99": "x"})
    assert exc.value.errors == {"1": "Please fill this in", "2": BAD_EMAIL, "99": "Unknown question"}


def test_validate_answers_drops_empty_optional_answers():
    questions = [q(QuestionType.SHORT_TEXT, id=1), q(QuestionType.MULTIPLE_CHOICE, MULTI, id=2)]
    assert validate_answers(questions, {"1": "", "2": []}) == {}
    assert validate_answers(questions, {"1": None, "2": ["b"]}) == {2: ["b"]}
