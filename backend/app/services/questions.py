from typing import Any

from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.db import lock_for_write
from app.core.errors import BadRequestError, FieldValidationError, NotFoundError, errors_from_pydantic
from app.models import Form, Question, QuestionType
from app.models.base import utcnow
from app.schemas.logic import Logic, rule_errors
from app.schemas.properties import default_properties, validate_properties
from app.schemas.question import QuestionCreate, QuestionUpdate


def get_question(db: Session, question_id: int) -> Question:
    question = db.get(Question, question_id)
    if question is None:
        raise NotFoundError("Question not found")
    return question


def _validated_properties(qtype: QuestionType, data: dict) -> dict:
    try:
        return validate_properties(qtype, data)
    except ValidationError as exc:
        raise FieldValidationError(errors_from_pydantic(exc, prefix="properties")) from exc


def _validated_logic(question: Question, data: dict[str, Any] | None) -> dict[str, Any] | None:
    """Checks rules against the question's type and its form; no rules is stored as null."""
    if data is None:
        return None
    try:
        logic = Logic.model_validate(data)
    except ValidationError as exc:
        raise FieldValidationError(errors_from_pydantic(exc, prefix="logic")) from exc

    errors = rule_errors(QuestionType(question.type), logic)
    # Any other question of the form; jumps that aren't forward are skipped at fill time (services/logic.py).
    targets = {q.id for q in question.form.questions} - {question.id}
    for i, rule in enumerate(logic.rules):
        if rule.to != "end" and rule.to not in targets:
            errors.setdefault(f"logic.rules.{i}.to", "Choose another question of this form")
    if errors:
        raise FieldValidationError(errors)
    return logic.model_dump() if logic.rules else None


def without_jumps_to(logic: dict[str, Any] | None, question_ids: set[int]) -> dict[str, Any] | None:
    if not logic:
        return logic
    rules = [rule for rule in logic.get("rules", []) if rule["to"] not in question_ids]
    return {"rules": rules} if rules else None


def _renumber(db: Session, ordered: list[Question]) -> None:
    """Writes contiguous positions 0..n-1 in list order.

    SQLite can't defer UNIQUE(form_id, position), and the ORM flushes updates in its own order,
    so rows first move to a free range above every current position, then to their final slot.
    """
    if all(q.position == i for i, q in enumerate(ordered)):
        return
    offset = max((q.position for q in ordered if q.position is not None), default=-1) + 1
    for i, q in enumerate(ordered):
        q.position = offset + i
    db.flush()
    for i, q in enumerate(ordered):
        q.position = i
    db.flush()


def lock_positions(db: Session, form: Form) -> None:
    """Serialises position changes on this form and re-reads its questions under the lock (core/db.py)."""
    lock_for_write(db)
    db.expire(form, ["questions"])


def _commit_question_change(db: Session, form: Form) -> None:
    form.updated_at = utcnow()
    db.commit()
    # The in-memory collection may be out of order now; reload it on next access.
    db.expire(form, ["questions"])


def create_question(db: Session, form: Form, data: QuestionCreate) -> Question:
    properties = (
        default_properties(data.type)
        if data.properties is None
        else _validated_properties(data.type, data.properties)
    )
    from app.question_types import get_spec
    spec = get_spec(data.type)
    question = Question(
        form_id=form.id,
        type=data.type,
        # A point has nothing to type a title into, so it gets a name for the page list.
        title=data.title or ("Partial submit point" if data.type == QuestionType.PARTIAL_SUBMIT else ""),
        description=data.description,
        required=data.required if spec.answerable else False,
        properties=properties,
    )
    lock_positions(db, form)
    db.add(question)

    ordered = list(form.questions)
    index = len(ordered) if data.position is None else min(data.position, len(ordered))
    ordered.insert(index, question)
    _renumber(db, ordered)
    _commit_question_change(db, form)
    return question


def update_question(db: Session, question: Question, data: QuestionUpdate) -> Question:
    from app.question_types import get_spec
    from app.models import Answer
    from app.core.errors import BadRequestError
    from sqlalchemy import delete
    
    old_type = QuestionType(question.type)
    
    # Process type change first if requested
    if "type" in data.model_fields_set and data.type is not None and data.type != old_type:
        new_type = data.type
        old_spec = get_spec(old_type)
        new_spec = get_spec(new_type)
        
        if not old_spec.answerable or not new_spec.answerable:
            raise BadRequestError("Cannot change into or out of group or statement")
            
        # Convert properties
        if hasattr(new_spec, "convert") and new_spec.convert is not None:
            new_props = new_spec.convert(old_type, question.properties)
        else:
            new_props = default_properties(new_type)
            
        question.type = new_type
        question.properties = new_props
        
        # Filter logic rules
        if question.logic and "rules" in question.logic:
            valid_rules = [
                r for r in question.logic["rules"] 
                if r.get("op") in new_spec.logic_ops
            ]
            if not valid_rules:
                question.logic = None
            else:
                question.logic = {"rules": valid_rules}
                
        # Wipe answers
        db.execute(delete(Answer).where(Answer.question_id == question.id))
        
        # Update spec to the new one for the rest of the fields
        spec = new_spec
    else:
        spec = get_spec(old_type)
    
    for field in data.model_fields_set:
        if field == "type":
            continue
            
        value = getattr(data, field)
        if field == "properties":
            value = _validated_properties(QuestionType(question.type), value)
        elif field == "logic":
            value = _validated_logic(question, value)
        elif field == "required" and not spec.answerable:
            value = False
        elif field == "group_id":
            # Just set it here, then do the move afterwards if it changed
            continue
            
        setattr(question, field, value)
        
    if "group_id" in data.model_fields_set and data.group_id != question.group_id:
        from app.services import groups
        if data.group_id is not None:
            group = next(q for q in question.form.questions if q.id == data.group_id)
            groups.add_to_group(db, question, group)
        else:
            groups.remove_from_group(db, question)
            
    _commit_question_change(db, question.form)
    return question


def delete_question(db: Session, question: Question) -> None:
    """Deletes the question (its answers cascade in the DB), drops jumps to it and closes the gap in positions."""
    from app.services import groups
    
    if question.type == QuestionType.GROUP:
        groups.delete_group(db, question)
        return
        
    form = question.form
    lock_positions(db, form)
    remaining = [q for q in form.questions if q.id != question.id]
    for q in remaining:
        q.logic = without_jumps_to(q.logic, {question.id})
    db.delete(question)
    db.flush()
    _renumber(db, remaining)
    _commit_question_change(db, form)


def reorder_questions(db: Session, form: Form, ordered_ids: list[int]) -> list[Question]:
    lock_positions(db, form)
    by_id = {q.id: q for q in form.questions}
    if len(ordered_ids) != len(by_id) or set(ordered_ids) != by_id.keys():
        raise BadRequestError("ordered_ids must list every question of this form exactly once.")
    ordered = [by_id[qid] for qid in ordered_ids]
    _renumber(db, ordered)
    _commit_question_change(db, form)
    return ordered
