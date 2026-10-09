from enum import StrEnum


class FormStatus(StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class QuestionType(StrEnum):
    SHORT_TEXT = "short_text"
    LONG_TEXT = "long_text"
    MULTIPLE_CHOICE = "multiple_choice"
    PICTURE_CHOICE = "picture_choice"
    DROPDOWN = "dropdown"
    EMAIL = "email"
    NUMBER = "number"
    YES_NO = "yes_no"
    RATING = "rating"
    WEBSITE = "website"
    PHONE_NUMBER = "phone_number"
    DATE = "date"
    LEGAL = "legal"
    CHECKBOX = "checkbox"
    OPINION_SCALE = "opinion_scale"
    NPS = "nps"
    STATEMENT = "statement"
    CONTACT_INFO = "contact_info"
    ADDRESS = "address"
    RANKING = "ranking"
    MATRIX = "matrix"
    GROUP = "group"
    FILE_UPLOAD = "file_upload"
    PAYMENT = "payment"


class ResponseStatus(StrEnum):
    PARTIAL = "partial"
    COMPLETED = "completed"
