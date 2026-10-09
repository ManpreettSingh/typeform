"""Structural blocks: statement, group header and partial submit point."""

from app.models.enums import QuestionType
from app.question_types.base import QuestionTypeSpec
from app.schemas.properties import EmptyProperties, GroupProperties, StatementProperties

def _format_empty(value, props) -> str:
    return ""

SPECS = [
    QuestionTypeSpec(
        key=QuestionType.STATEMENT,
        properties_model=StatementProperties,
        answerable=False,
        defaults=lambda: StatementProperties().model_dump(exclude_none=True),
        validate=None,
        format=_format_empty,
        summarize=None,
        sample=None,
        logic_ops=frozenset(),
        logic_match=None,
        logic_value_error=None,
    ),
    QuestionTypeSpec(
        key=QuestionType.GROUP,
        properties_model=GroupProperties,
        answerable=False,
        defaults=lambda: GroupProperties().model_dump(exclude_none=True),
        validate=None,
        format=_format_empty,
        summarize=None,
        sample=None,
        logic_ops=frozenset(),
        logic_match=None,
        logic_value_error=None,
    ),
    # Takes no answer and shows nothing to respondents: when one reaches it, their answers so far count as a
    # submission (services/submissions.py save_progress).
    QuestionTypeSpec(
        key=QuestionType.PARTIAL_SUBMIT,
        properties_model=EmptyProperties,
        answerable=False,
        defaults=lambda: EmptyProperties().model_dump(exclude_none=True),
        validate=None,
        format=_format_empty,
        summarize=None,
        sample=None,
    ),
]
