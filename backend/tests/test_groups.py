from sqlalchemy import select
from app.models.question import Question

def test_delete_group_removes_children(client, make_form, add_question, db):
    form_id = make_form()["id"]
    group = add_question(form_id, "group")
    q1 = add_question(form_id, "short_text")
    q2 = add_question(form_id, "short_text")
    
    # Add to group
    client.patch(f"/api/questions/{q1['id']}", json={"group_id": group['id']})
    client.patch(f"/api/questions/{q2['id']}", json={"group_id": group['id']})
    
    questions = client.get(f"/api/forms/{form_id}").json()["questions"]
    assert len(questions) == 3
    assert questions[1]["group_id"] == group["id"]
    assert questions[2]["group_id"] == group["id"]
    
    # Delete group
    res = client.delete(f"/api/questions/{group['id']}")
    assert res.status_code == 204
    
    remaining = client.get(f"/api/forms/{form_id}").json()["questions"]
    assert len(remaining) == 0

def test_child_moved_out_leaves_group(client, make_form, add_question):
    form_id = make_form()["id"]
    group = add_question(form_id, "group")
    child = add_question(form_id, "short_text")
    
    client.patch(f"/api/questions/{child['id']}", json={"group_id": group['id']})
    assert client.get(f"/api/forms/{form_id}").json()["questions"][1]["group_id"] == group["id"]
    
    client.patch(f"/api/questions/{child['id']}", json={"group_id": None})
    assert client.get(f"/api/forms/{form_id}").json()["questions"][1]["group_id"] is None

def test_empty_group_skipped_by_path(client, make_form, add_question):
    form_id = make_form()["id"]
    group = add_question(form_id, "group")
    child = add_question(form_id, "short_text")
    # By default it's just sequential, but let's see.
    # Group is empty. Child is not in group.
    # Wait, the frontend `visitedPath` and backend `visited_path` handle this.
    # We can test `visited_path` from `backend.app.services.logic`.
    from app.services.logic import visited_path
    from app.models.question import Question
    
    questions = [
        Question(id=1, type="group", group_id=None),
        Question(id=2, type="short_text", group_id=None)
    ]
    path = visited_path(questions, {})
    assert path == [1]

def test_jump_to_group_lands_on_first_child(client, make_form, add_question):
    from app.services.logic import visited_path
    from app.models.question import Question
    
    questions = [
        Question(id=1, type="short_text", group_id=None, logic={"rules": [{"op": "is", "value": "A", "to": 3}]}),
        Question(id=2, type="short_text", group_id=None),
        Question(id=3, type="group", group_id=None),
        Question(id=4, type="short_text", group_id=3)
    ]
    path = visited_path(questions, {1: "A"})
    assert path == [0, 3]

def test_group_not_in_results_or_csv(client, make_form, add_question):
    from app.question_types import get_spec
    from app.models.enums import QuestionType
    assert get_spec(QuestionType.GROUP).answerable is False
    assert get_spec(QuestionType.GROUP).summarize is None

def test_group_title_in_public_api(client, make_form, add_question):
    form = make_form()
    form_id = form["id"]
    slug = form["slug"]
    group = add_question(form_id, "group")
    client.patch(f"/api/questions/{group['id']}", json={"title": "My Group"})
    
    child = add_question(form_id, "short_text")
    client.patch(f"/api/questions/{child['id']}", json={"group_id": group["id"]})
    
    # Publish
    client.post(f"/api/forms/{form_id}/publish")
    
    res = client.get(f"/api/public/forms/{slug}")
    assert res.status_code == 200
    questions = res.json()["questions"]
    assert len(questions) == 2
    
    assert questions[0]["type"] == "group"
    assert questions[1]["type"] == "short_text"
    assert questions[1]["group_id"] == group["id"]
    assert questions[1]["group_title"] == "My Group"
