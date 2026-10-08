"""CSV export of a form's responses (bonus). Answers are written human-readable, like the results UI."""

import csv
import io
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Form, Question, QuestionType, Response

# Spreadsheet apps run cells starting with these as formulas (CSV injection).
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def format_answer(question: Question, value: Any) -> str:
    """Display text for a stored answer; mirrors frontend/lib/answerFormat.ts."""
    qtype = QuestionType(question.type)
    if qtype == QuestionType.YES_NO:
        return "Yes" if value else "No"
    if qtype in (QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN):
        labels = {o["id"]: o["label"] or "(untitled choice)" for o in question.properties["options"]}
        ids = value if isinstance(value, list) else [value]
        return "; ".join(labels.get(i, "(removed choice)") for i in ids)
    if qtype == QuestionType.RATING:
        return f"{value}/{question.properties['max']}"
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return str(value)


def _safe_cell(text: str) -> str:
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def _iso(dt) -> str:
    return dt.isoformat().replace("+00:00", "Z") if dt else ""


def responses_csv(db: Session, form: Form) -> str:
    questions = list(form.questions)
    responses = db.scalars(
        select(Response)
        .where(Response.form_id == form.id)
        .order_by(func.coalesce(Response.submitted_at, Response.started_at).desc(), Response.id.desc())
        .options(selectinload(Response.answers))
    ).all()

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        ["Response ID", "Status", "Started at", "Submitted at", *(_safe_cell(q.title or "Untitled question") for q in questions)]
    )
    for response in responses:
        by_question = {a.question_id: a.value for a in response.answers}
        cells = [_safe_cell(format_answer(q, by_question[q.id])) if q.id in by_question else "" for q in questions]
        writer.writerow([response.id, response.status, _iso(response.started_at), _iso(response.submitted_at), *cells])
    return out.getvalue()
