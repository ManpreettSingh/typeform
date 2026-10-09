import pytest
from sqlalchemy.orm import Session

from app.models import Form, Question, QuestionType
from app.schemas.question import QuestionUpdate
from app.services.questions import update_question
from app.core.errors import BadRequestError
from app.models.answer import Answer
from app.models.response import Response

def test_change_choice_to_dropdown_keeps_options(db: Session, make_form, add_question):
    form_data = make_form()
    q_data = add_question(form_data["id"], type=QuestionType.MULTIPLE_CHOICE)
    question = db.get(Question, q_data["id"])
    question.properties = {"options": [{"id": "a", "label": "A"}]}
    db.commit()
    
    update = QuestionUpdate(type=QuestionType.DROPDOWN)
    updated = update_question(db, question, update)
    
    assert updated.type == QuestionType.DROPDOWN.value
    assert updated.properties["options"] == [{"id": "a", "label": "A"}]

def test_change_type_deletes_answers(db: Session, make_form, add_question):
    form_data = make_form()
    q_data = add_question(form_data["id"], type=QuestionType.SHORT_TEXT)
    question = db.get(Question, q_data["id"])
    response = Response(form_id=form_data["id"])
    db.add(response)
    db.commit()
    
    answer = Answer(response_id=response.id, question_id=question.id, value="x")
    db.add(answer)
    db.commit()
    
    assert db.query(Answer).count() == 1
    
    update = QuestionUpdate(type=QuestionType.NUMBER)
    update_question(db, question, update)
    
    assert db.query(Answer).count() == 0

def test_change_type_drops_incompatible_rules(db: Session, make_form, add_question):
    form_data = make_form()
    q_data = add_question(form_data["id"], type=QuestionType.SHORT_TEXT)
    question = db.get(Question, q_data["id"])
    question.logic = {"rules": [{"op": "contains", "value": "x", "to": "end"}]}
    db.commit()
    
    update = QuestionUpdate(type=QuestionType.NUMBER)
    updated = update_question(db, question, update)
    
    assert updated.logic is None

def test_cannot_change_into_group(db: Session, make_form, add_question):
    form_data = make_form()
    q_data = add_question(form_data["id"], type=QuestionType.SHORT_TEXT)
    question = db.get(Question, q_data["id"])
    update = QuestionUpdate(type=QuestionType.GROUP)
    
    with pytest.raises(BadRequestError):
        update_question(db, question, update)
