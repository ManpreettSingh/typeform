import pytest
from app.models.enums import QuestionType
from app.models.response import Response, ResponseStatus
from app.services.export import responses_csv
import csv
import io

def test_csv_has_one_column_per_answerable_question_and_none_for_groups_or_statements(db, make_form, add_question):
    form_dict = make_form()
    # Add answerable questions
    q1 = add_question(form_dict["id"], "short_text", title="Name")
    q2 = add_question(form_dict["id"], "rating", title="Rating")
    
    # Add unanswerable questions
    add_question(form_dict["id"], "statement", title="Statement")
    add_question(form_dict["id"], "group", title="Group")

    from app.models import Form
    form = db.query(Form).filter(Form.id == form_dict["id"]).first()

    # Export CSV
    csv_str = responses_csv(db, form)
    
    # Read headers
    reader = csv.reader(io.StringIO(csv_str))
    headers = next(reader)
    
    # Expected headers: 4 standard columns + 2 answerable question columns
    assert headers == ["Response ID", "Status", "Started at", "Submitted at", "Name", "Rating"]
