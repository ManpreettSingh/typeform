"""CSV export of a form's responses (bonus). Answers are written human-readable, like the results UI."""

import csv
import io
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.models import Form, Question, Response
from app.question_types import get_spec

# Spreadsheet apps run cells starting with these as formulas (CSV injection).
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def format_answer(question: Question, value: Any) -> str:
    """Display text for a stored answer; mirrors frontend/lib/answerFormat.ts."""
    return get_spec(question.type).format(value, question.properties)


def safe_cell(text: str) -> str:
    return f"'{text}" if text.startswith(_FORMULA_PREFIXES) else text


def _iso(dt) -> str:
    return dt.isoformat().replace("+00:00", "Z") if dt else ""


def responses_csv(db: Session, form: Form) -> str:
    questions = [q for q in form.questions if get_spec(q.type).answerable]
    responses = db.scalars(
        select(Response)
        .where(Response.form_id == form.id)
        .order_by(func.coalesce(Response.submitted_at, Response.started_at).desc(), Response.id.desc())
        .options(selectinload(Response.answers))
    ).all()

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(
        ["Response ID", "Status", "Started at", "Submitted at", *(safe_cell(q.title or "Untitled question") for q in questions)]
    )
    for response in responses:
        by_question = {a.question_id: a.value for a in response.answers}
        cells = [safe_cell(format_answer(q, by_question[q.id])) if q.id in by_question else "" for q in questions]
        writer.writerow([response.id, response.status, _iso(response.started_at), _iso(response.submitted_at), *cells])
    return out.getvalue()
