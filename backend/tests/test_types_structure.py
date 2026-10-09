

import pytest

from app.models.enums import QuestionType
from app.schemas.logic import Logic, rule_errors
from app.services.stats import summarize_form
from app.services.export import responses_csv


def test_statement_never_stored(client, make_form, add_question):
    form = make_form()
    q_text = add_question(form["id"], "short_text")
    q_stmt = add_question(form["id"], "statement", properties={"button_text": "Next"})
    
    client.post(f"/api/forms/{form['id']}/publish")
    
    # A submission with statement id is rejected
    res = client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": {str(q_text["id"]): "hello", str(q_stmt["id"]): "should fail"}}
    )
    assert res.status_code == 422
    assert "Unknown question" in res.json()["detail"]["errors"][str(q_stmt["id"])]

    # Empty statement is fine
    res2 = client.post(
        f"/api/public/forms/{form['slug']}/responses",
        json={"answers": {str(q_text["id"]): "hello"}}
    )
    assert res2.status_code == 201


def test_statement_not_in_summary_or_csv(client, db, make_form, add_question):
    from app.models import Form
    form_data = make_form()
    q_text = add_question(form_data["id"], "short_text", title="Q1")
    q_stmt = add_question(form_data["id"], "statement", title="Stmt")
    
    client.post(f"/api/forms/{form_data['id']}/publish")
    client.post(
        f"/api/public/forms/{form_data['slug']}/responses",
        json={"answers": {str(q_text["id"]): "hello"}}
    )
    
    form = db.get(Form, form_data["id"])

    # summarize_form should skip the statement
    summary = summarize_form(db, form)
    assert len(summary.questions) == 1
    assert summary.questions[0].question_id == q_text["id"]
    
    # CSV should skip the statement
    csv_text = responses_csv(db, form)
    assert "Q1" in csv_text
    assert "Stmt" not in csv_text


def test_statement_can_be_jump_target():
    # Can target statement
    logic = Logic(rules=[{"op": "is", "value": "jump", "to": 999}])
    errors = rule_errors(QuestionType.SHORT_TEXT, logic)
    assert not errors

    # Cannot have logic ON a statement
    logic_on_stmt = Logic(rules=[{"op": "is", "value": "jump", "to": "end"}])
    errors_on_stmt = rule_errors(QuestionType.STATEMENT, logic_on_stmt)
    assert "logic" in errors_on_stmt
    assert "Rules cannot be added" in errors_on_stmt["logic"]
