def test_first_ending_created_with_form(client, make_form):
    form = make_form()
    assert len(form["endings"]) == 1
    ending = form["endings"][0]
    assert ending["title"] == "Thanks for completing this form"
    assert ending["position"] == 0

def test_cannot_delete_last_ending(client, make_form):
    form = make_form()
    ending = form["endings"][0]
    res = client.delete(f"/api/endings/{ending['id']}")
    assert res.status_code == 409
    assert res.json()["detail"] == "A form must have at least one ending"

def test_duplicate_form_copies_endings(client, make_form):
    form = make_form()
    form_id = form["id"]
    client.post(f"/api/forms/{form_id}/endings", json={"title": "Second ending", "message": "Bye"})
    
    res = client.post(f"/api/forms/{form_id}/duplicate")
    assert res.status_code == 201
    dup_form = res.json()
    assert len(dup_form["endings"]) == 2
    assert dup_form["endings"][1]["title"] == "Second ending"

def test_welcome_button_text_limit_24(client, make_form):
    form = make_form()
    form_id = form["id"]
    res = client.patch(f"/api/forms/{form_id}", json={
        "welcome": {"button_text": "x" * 25}
    })
    assert res.status_code == 422

def test_public_form_includes_submission_count_only_when_enabled(client, make_form, add_question):
    form = make_form()
    form_id = form["id"]
    add_question(form_id, "short_text")
    
    # Submit a dummy response so count > 0 (Wait, it's not published yet, can't submit)
    client.patch(f"/api/forms/{form_id}", json={"status": "published"})
    client.post(f"/api/forms/{form_id}/publish") # ensure it's published correctly if this route is used
    
    slug = form["slug"]
    
    res = client.get(f"/api/public/forms/{slug}")
    assert res.status_code == 200
    assert res.json()["submission_count"] is None
    
    # Enable it
    client.patch(f"/api/forms/{form_id}", json={
        "welcome": {"show_submission_count": True}
    })
    
    res = client.get(f"/api/public/forms/{slug}")
    assert res.status_code == 200
    assert res.json()["submission_count"] == 0
