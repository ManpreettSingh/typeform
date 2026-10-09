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

MEDIA = {
    "attachment": {"type": "image", "public_id": "p", "url": "https://example.com/a.png", "alt": "A", "brightness": -20},
    "layout": {"type": "split", "placement": "right"},
    "viewport_overrides": {"small": {"type": "wallpaper", "placement": None}},
}


def test_ending_media_is_saved(client, make_form):
    form = make_form()
    ending_id = form["endings"][0]["id"]
    assert client.patch(f"/api/endings/{ending_id}", json=MEDIA).status_code == 200

    saved = client.get(f"/api/forms/{form['id']}").json()["endings"][0]
    assert saved["attachment"]["url"] == "https://example.com/a.png"
    assert saved["attachment"]["brightness"] == -20
    assert saved["layout"] == {"type": "split", "placement": "right"}
    assert saved["viewport_overrides"] == {"small": {"type": "wallpaper", "placement": None}}

    # Removing the image clears it.
    client.patch(f"/api/endings/{ending_id}", json={"attachment": None, "layout": None})
    cleared = client.get(f"/api/forms/{form['id']}").json()["endings"][0]
    assert cleared["attachment"] is None and cleared["layout"] is None


def test_new_ending_and_duplicate_keep_media(client, make_form):
    form = make_form()
    created = client.post(f"/api/forms/{form['id']}/endings", json={"title": "Pic", **MEDIA}).json()
    assert created["attachment"]["url"] == "https://example.com/a.png"

    dup = client.post(f"/api/forms/{form['id']}/duplicate").json()
    assert dup["endings"][1]["layout"] == {"type": "split", "placement": "right"}


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
