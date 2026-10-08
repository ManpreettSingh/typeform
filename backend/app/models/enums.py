from enum import StrEnum


class FormStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class QuestionType(StrEnum):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    MULTIPLE_CHOICE = "multiple_choice"
    DROPDOWN = "dropdown"
    EMAIL = "email"
    NUMBER = "number"
    YES_NO = "yes_no"
    RATING = "rating"


class ResponseStatus(StrEnum):
    PARTIAL = "partial"
    COMPLETED = "completed"
