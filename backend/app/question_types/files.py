"""File upload: the respondent uploads one file straight to Cloudinary (signed by POST /public/forms/{slug}/uploads)
and the answer stores where it went: {"url", "name", "size", "type"}."""

import random
from datetime import datetime
from typing import Any

from app.models import Question, QuestionType
from app.question_types.base import AnswerError, Properties, QuestionTypeSpec, is_number
from app.schemas.properties import EmptyProperties
from app.schemas.response import FileAnswer, FileSummary

# Typeform's limit for file uploads.
MAX_FILE_BYTES = 10 * 1024 * 1024
NAME_MAX = 255
URL_MAX = 2000
TYPE_MAX = 100
UPLOAD_ERROR = "Please upload a file"

_SAMPLES = [
    ("cv.pdf", "application/pdf", 182_340),
    ("portfolio.zip", "application/zip", 2_412_118),
    ("receipt.png", "image/png", 341_902),
    ("notes.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 48_210),
]


def _validate(value: Any, _props: Properties) -> dict[str, Any]:
    if not isinstance(value, dict):
        raise AnswerError(UPLOAD_ERROR)
    url, name, size, mime = value.get("url"), value.get("name"), value.get("size"), value.get("type")
    if not isinstance(url, str) or not url.startswith(("https://", "http://")) or len(url) > URL_MAX:
        raise AnswerError(UPLOAD_ERROR)
    if not isinstance(name, str) or not name.strip() or len(name) > NAME_MAX:
        raise AnswerError(UPLOAD_ERROR)
    if not is_number(size) or size < 0:
        raise AnswerError(UPLOAD_ERROR)
    if size > MAX_FILE_BYTES:
        raise AnswerError("That file is too big. The size limit is 10MB")
    stored: dict[str, Any] = {"url": url, "name": name.strip(), "size": int(size)}
    if isinstance(mime, str) and mime and len(mime) <= TYPE_MAX:
        stored["type"] = mime
    return stored


def _format(value: Any, _props: Properties) -> str:
    if isinstance(value, dict) and value.get("url"):
        return f"{value.get('name') or 'file'} ({value['url']})"
    return str(value)


def _summarize(question: Question, values: list[Any], times: list[datetime]) -> FileSummary:
    files = [
        FileAnswer(name=str(v.get("name") or "file"), url=str(v["url"]), size=int(v.get("size") or 0), submitted_at=t)
        for v, t in zip(values, times, strict=True)
        if isinstance(v, dict) and v.get("url")
    ]
    return FileSummary(question_id=question.id, type=QuestionType.FILE_UPLOAD, title=question.title, answered=len(files), files=files)


def _sample(_props: Properties, rng: random.Random) -> dict[str, Any]:
    name, mime, size = rng.choice(_SAMPLES)
    return {"url": f"https://res.cloudinary.com/demo/raw/upload/v1/samples/{name}", "name": name, "size": size, "type": mime}


SPECS = [
    QuestionTypeSpec(
        key=QuestionType.FILE_UPLOAD,
        properties_model=EmptyProperties,
        answerable=True,
        defaults=lambda: EmptyProperties().model_dump(exclude_none=True),
        validate=_validate,
        format=_format,
        summarize=_summarize,
        sample=_sample,
        required_message=UPLOAD_ERROR,
    )
]
