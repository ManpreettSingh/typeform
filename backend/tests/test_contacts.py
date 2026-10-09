"""Contacts, modelled on Typeform's: a persisted, editable contact database that fills from form submissions, CSV
imports and manual entry, with search, filters, saved lists, subscription status and bulk delete."""

import json

import pytest

URL = "/api/contacts"


def create(client, **fields):
    res = client.post(URL, json=fields)
    assert res.status_code == 201, res.text
    return res.json()


def listing(client, **params):
    res = client.get(URL, params=params)
    assert res.status_code == 200, res.text
    return res.json()


def emails(page) -> list[str]:
    return [c["email"] for c in page["items"]]


def filters(operator="and", **conditions):
    return json.dumps({"operator": operator, "conditions": [{"property": p, "op": op, "value": v} for p, (op, v) in conditions.items()]})


# ---- creating one contact -----------------------------------------------------------------------------------------


def test_a_contact_added_individually(client) -> None:
    c = create(client, name="Jamie Rivera", email="Jamie@Example.com", phone="+12015550123", company="Acme", notes="Asked about pricing")
    assert c["email"] == "jamie@example.com"  # one contact per address, however it is typed
    assert (c["name"], c["phone"], c["company"], c["notes"]) == ("Jamie Rivera", "+12015550123", "Acme", "Asked about pricing")
    assert c["subscription_status"] == "never_subscribed"
    assert c["sources"] == [{"type": "manual"}]
    assert c["last_update_source"] == "manual_edit"
    assert [h["status"] for h in c["subscription_history"]] == ["never_subscribed"]
    assert c["created_at"] and c["updated_at"]


def test_a_contact_needs_an_email_or_a_name(client) -> None:
    assert client.post(URL, json={}).status_code == 422
    assert client.post(URL, json={"phone": "+12015550123"}).status_code == 422
    assert client.post(URL, json={"name": "No Email"}).status_code == 201
    assert client.post(URL, json={"email": "only@example.com"}).status_code == 201


@pytest.mark.parametrize(
    ("field", "value"),
    [("email", "not-an-email"), ("email", "a" * 250 + "@x.io"), ("name", "n" * 255), ("notes", "n" * 1001), ("phone", "p" * 65), ("company", "c" * 255)],
)
def test_contact_fields_are_limited_like_typeforms(client, field, value) -> None:
    res = client.post(URL, json={"email": "ok@example.com", field: value})
    assert res.status_code == 422 and field in res.json()["detail"]["errors"]


def test_two_contacts_cant_share_an_email(client) -> None:
    create(client, email="dup@example.com")
    res = client.post(URL, json={"email": "DUP@example.com"})
    assert res.status_code == 422 and "already" in res.json()["detail"]["errors"]["email"]


def test_suppressed_cant_be_chosen_by_hand(client) -> None:
    res = client.post(URL, json={"email": "s@example.com", "subscription_status": "suppressed"})
    assert res.status_code == 422 and "subscription_status" in res.json()["detail"]["errors"]
    assert client.post(URL, json={"email": "s@example.com", "subscription_status": "bogus"}).status_code == 422


# ---- editing, subscription history, deleting ------------------------------------------------------------------------


def test_editing_a_contact_updates_it_and_its_subscription_history(client) -> None:
    c = create(client, email="ed@example.com", name="Ed")
    res = client.patch(f"{URL}/{c['id']}", json={"name": "Edward", "subscription_status": "subscribed", "notes": "VIP"})
    assert res.status_code == 200, res.text
    edited = res.json()
    assert edited["name"] == "Edward" and edited["notes"] == "VIP"
    assert [h["status"] for h in edited["subscription_history"]] == ["never_subscribed", "subscribed"]
    assert edited["updated_at"] >= c["updated_at"]

    # Saving the same status again isn't a change.
    again = client.patch(f"{URL}/{c['id']}", json={"subscription_status": "subscribed"}).json()
    assert len(again["subscription_history"]) == 2


def test_a_cleared_field_is_removed(client) -> None:
    c = create(client, email="clr@example.com", name="Clear Me", phone="+12015550123")
    edited = client.patch(f"{URL}/{c['id']}", json={"phone": ""}).json()
    assert edited["phone"] is None and edited["name"] == "Clear Me"


def test_editing_cant_take_another_contacts_email(client) -> None:
    create(client, email="a@example.com")
    b = create(client, email="b@example.com")
    res = client.patch(f"{URL}/{b['id']}", json={"email": "A@example.com"})
    assert res.status_code == 422 and "email" in res.json()["detail"]["errors"]
    assert client.patch(f"{URL}/{b['id']}", json={"email": "b@example.com"}).status_code == 200


def test_unknown_contacts_are_404(client) -> None:
    assert client.get(f"{URL}/999").status_code == 404
    assert client.patch(f"{URL}/999", json={"name": "x"}).status_code == 404
    assert client.delete(f"{URL}/999").status_code == 404


def test_deleting_one_contact_and_many(client) -> None:
    a, b, c = (create(client, email=f"{n}@example.com") for n in "abc")
    assert client.delete(f"{URL}/{a['id']}").status_code == 204
    assert client.get(f"{URL}/{a['id']}").status_code == 404

    res = client.post(f"{URL}/bulk-delete", json={"ids": [b["id"], c["id"], 12345]})
    assert res.status_code == 200 and res.json() == {"deleted": 2}
    assert listing(client)["total"] == 0


# ---- the table: search, sort ------------------------------------------------------------------------------------------


def test_search_looks_across_name_email_phone_and_text_properties(client) -> None:
    create(client, name="Ana Silva", email="ana@one.io")
    create(client, name="Bo", email="bo@two.io", phone="+12015550123")
    create(client, name="Cy", email="cy@three.io", company="Silvaworks", notes="loves tea")
    assert emails(listing(client, query="silva")) == ["cy@three.io", "ana@one.io"] or set(emails(listing(client, query="silva"))) == {"ana@one.io", "cy@three.io"}
    assert emails(listing(client, query="TWO.IO")) == ["bo@two.io"]
    assert emails(listing(client, query="5550123")) == ["bo@two.io"]
    assert emails(listing(client, query="tea")) == ["cy@three.io"]
    assert listing(client, query="nobody")["total"] == 0


def test_the_newest_change_comes_first_and_columns_can_be_sorted(client) -> None:
    create(client, name="Zed", email="zed@x.io")
    create(client, name="Amy", email="amy@x.io")
    assert emails(listing(client)) == ["amy@x.io", "zed@x.io"]
    assert emails(listing(client, sort="updated_at", order="asc")) == ["zed@x.io", "amy@x.io"]
    assert emails(listing(client, sort="name", order="asc")) == ["amy@x.io", "zed@x.io"]
    assert emails(listing(client, sort="email", order="desc")) == ["zed@x.io", "amy@x.io"]
    assert client.get(URL, params={"sort": "bogus"}).status_code == 422


def test_the_contact_column_sorts_by_name_then_email(client) -> None:
    create(client, email="m@x.io")  # no name: shows its email
    create(client, name="Alpha", email="z@x.io")
    assert emails(listing(client, sort="contact", order="asc")) == ["z@x.io", "m@x.io"]


# ---- filters and lists ------------------------------------------------------------------------------------------------


@pytest.fixture
def people(client):
    create(client, name="Ana", email="ana@fr.io", company="Acme France", subscription_status="subscribed")
    create(client, name="Bo", email="bo@us.io", company="Acme US", notes="vip")
    create(client, name="Cy", email="cy@fr.io", subscription_status="unsubscribed")


def test_text_filters(client, people) -> None:
    assert set(emails(listing(client, filters=filters(company=("contains", "france"))))) == {"ana@fr.io"}
    assert set(emails(listing(client, filters=filters(company=("not_contains", "france"))))) == {"bo@us.io", "cy@fr.io"}
    assert set(emails(listing(client, filters=filters(company=("is_empty", None))))) == {"cy@fr.io"}
    assert set(emails(listing(client, filters=filters(notes=("is_not_empty", None))))) == {"bo@us.io"}


def test_subscription_status_filters(client, people) -> None:
    assert set(emails(listing(client, filters=filters(subscription_status=("is", "subscribed"))))) == {"ana@fr.io"}
    assert set(emails(listing(client, filters=filters(subscription_status=("is_not", "subscribed"))))) == {"bo@us.io", "cy@fr.io"}


def test_and_needs_every_condition_and_or_needs_one(client, people) -> None:
    conditions = {"email": ("contains", "fr.io"), "subscription_status": ("is", "subscribed")}
    assert set(emails(listing(client, filters=filters("and", **conditions)))) == {"ana@fr.io"}
    assert set(emails(listing(client, filters=filters("or", **conditions)))) == {"ana@fr.io", "cy@fr.io"}


def test_search_and_filters_work_together(client, people) -> None:
    page = listing(client, query="acme", filters=filters(subscription_status=("is", "subscribed")))
    assert emails(page) == ["ana@fr.io"] and page["total"] == 1


@pytest.mark.parametrize(
    "bad",
    [
        "not json",
        json.dumps({"operator": "xor", "conditions": []}),
        json.dumps({"operator": "and", "conditions": [{"property": "bogus", "op": "contains", "value": "x"}]}),
        json.dumps({"operator": "and", "conditions": [{"property": "name", "op": "is", "value": "x"}]}),
        json.dumps({"operator": "and", "conditions": [{"property": "subscription_status", "op": "is", "value": "bogus"}]}),
    ],
)
def test_malformed_filters_are_rejected(client, bad) -> None:
    assert client.get(URL, params={"filters": bad}).status_code == 422


def test_saving_filters_as_a_contact_list(client, people) -> None:
    spec = {"operator": "and", "conditions": [{"property": "email", "op": "contains", "value": "fr.io"}]}
    res = client.post(f"{URL}/lists", json={"name": "France", "filters": spec})
    assert res.status_code == 201, res.text
    saved = res.json()
    assert saved["name"] == "France" and saved["count"] == 2

    assert set(emails(listing(client, list_id=saved["id"]))) == {"ana@fr.io", "cy@fr.io"}
    # A list narrows further with search.
    assert emails(listing(client, list_id=saved["id"], query="ana")) == ["ana@fr.io"]
    assert [lst["name"] for lst in client.get(f"{URL}/lists").json()] == ["France"]

    renamed = client.patch(f"{URL}/lists/{saved['id']}", json={"name": "Europe"}).json()
    assert renamed["name"] == "Europe" and renamed["count"] == 2
    assert client.delete(f"{URL}/lists/{saved['id']}").status_code == 204
    assert client.get(f"{URL}/lists").json() == []
    assert client.get(URL, params={"list_id": saved["id"]}).status_code == 404


def test_list_names_are_required_and_unique(client) -> None:
    spec = {"operator": "and", "conditions": []}
    assert client.post(f"{URL}/lists", json={"name": " ", "filters": spec}).status_code == 422
    assert client.post(f"{URL}/lists", json={"name": "VIPs", "filters": spec}).status_code == 201
    assert client.post(f"{URL}/lists", json={"name": "vips", "filters": spec}).status_code == 422
    assert client.post(f"{URL}/lists", json={"name": "Bad", "filters": {"operator": "and", "conditions": [{"property": "x", "op": "is", "value": 1}]}}).status_code == 422


# ---- CSV import -------------------------------------------------------------------------------------------------------


def test_import_creates_updates_and_reports_what_it_skipped(client) -> None:
    create(client, email="old@example.com", name="Old Name", notes="keep me")
    rows = [
        {"email": "new@example.com", "name": "New One", "subscription_status": "Subscribed"},
        {"email": "OLD@example.com", "name": "Renamed", "company": "Acme"},
        {"email": "broken", "name": "Bad Email"},
        {"phone": "+12015550123"},
        {"name": "No Email Person"},
        {"email": "odd@example.com", "subscription_status": "sometimes"},
    ]
    res = client.post(f"{URL}/import", json={"rows": rows})
    assert res.status_code == 200, res.text
    body = res.json()
    assert (body["created"], body["updated"]) == (2, 1)
    assert [e["row"] for e in body["errors"]] == [3, 4, 6]  # 1-based, as in the file

    new = next(c for c in listing(client)["items"] if c["email"] == "new@example.com")
    assert new["subscription_status"] == "subscribed" and new["sources"] == [{"type": "csv_import"}]
    assert new["last_update_source"] == "csv_import"
    old = next(c for c in listing(client)["items"] if c["email"] == "old@example.com")
    assert old["name"] == "Renamed" and old["company"] == "Acme" and old["notes"] == "keep me"
    assert {"type": "manual"} in old["sources"] and {"type": "csv_import"} in old["sources"]


def test_import_reads_subscription_labels_the_way_people_write_them(client) -> None:
    rows = [{"email": f"{i}@example.com", "subscription_status": s} for i, s in enumerate(["subscribed", "Unsubscribed", "Never subscribed", "never_subscribed"])]
    assert client.post(f"{URL}/import", json={"rows": rows}).json()["created"] == 4
    statuses = {c["email"]: c["subscription_status"] for c in listing(client)["items"]}
    assert list(statuses.values()).count("never_subscribed") == 2 and statuses["0@example.com"] == "subscribed"


def test_import_is_capped(client) -> None:
    assert client.post(f"{URL}/import", json={"rows": []}).status_code == 422
    assert client.post(f"{URL}/import", json={"rows": [{"email": f"{i}@x.io"} for i in range(5001)]}).status_code == 422


# ---- contacts from form submissions -------------------------------------------------------------------------------------


def published_form(client, add_question, make_form, title, *questions):
    form = make_form(title)
    made = [add_question(form["id"], q[0], title=q[1]) for q in questions]
    client.post(f"/api/forms/{form['id']}/publish")
    return form, made


def submit(client, form, answers):
    res = client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(q["id"]): v for q, v in answers}})
    assert res.status_code == 201, res.text


def test_a_submission_with_an_email_becomes_a_contact(client, make_form, add_question) -> None:
    form, (name, email) = published_form(client, add_question, make_form, "Newsletter", ("short_text", "Your name"), ("email", "Your email"))
    submit(client, form, [(name, "Alice Walker"), (email, "Alice@Example.com")])
    [alice] = listing(client)["items"]
    assert alice["email"] == "alice@example.com" and alice["name"] == "Alice Walker"
    assert alice["sources"] == [{"type": "form", "form_id": form["id"], "form_title": "Newsletter"}]
    assert alice["last_update_source"] == "sync"
    assert alice["subscription_status"] == "never_subscribed"


def test_contact_info_answers_fill_name_phone_and_company(client, make_form, add_question) -> None:
    form, (info,) = published_form(client, add_question, make_form, "Sign up", ("contact_info", "About you"))
    submit(client, form, [(info, {"first_name": "Priya", "last_name": "Shah", "email": "priya@example.com", "phone_number": "+12015550123", "company": "Initech"})])
    [priya] = listing(client)["items"]
    assert (priya["name"], priya["phone"], priya["company"]) == ("Priya Shah", "+12015550123", "Initech")


def test_the_same_person_on_two_forms_is_one_contact_with_two_sources(client, make_form, add_question) -> None:
    one, (e1,) = published_form(client, add_question, make_form, "One", ("email", "Email"))
    two, (e2,) = published_form(client, add_question, make_form, "Two", ("email", "Email"))
    submit(client, one, [(e1, "same@example.com")])
    submit(client, two, [(e2, "SAME@example.com")])
    submit(client, two, [(e2, "same@example.com")])  # again on the same form: still two sources
    page = listing(client)
    assert page["total"] == 1
    assert [s["form_title"] for s in page["items"][0]["sources"]] == ["One", "Two"]


def test_a_new_submission_fills_gaps_but_never_overwrites_what_you_typed(client, make_form, add_question) -> None:
    form, (name, email) = published_form(client, add_question, make_form, "F", ("short_text", "Name"), ("email", "Email"))
    mine = create(client, email="kept@example.com", name="Name I Typed")
    submit(client, form, [(name, "Name From Form"), (email, "kept@example.com")])
    after = client.get(f"{URL}/{mine['id']}").json()
    assert after["name"] == "Name I Typed"
    assert after["sources"][-1]["type"] == "form"

    blank = create(client, email="blank@example.com")
    submit(client, form, [(name, "Filled In"), (email, "blank@example.com")])
    assert client.get(f"{URL}/{blank['id']}").json()["name"] == "Filled In"


def test_no_email_means_no_contact_and_partials_dont_count(client, make_form, add_question) -> None:
    form, (name, email) = published_form(client, add_question, make_form, "F", ("short_text", "Name"), ("email", "Email"))
    client.post(f"/api/public/forms/{form['slug']}/responses", json={"answers": {str(name["id"]): "Just a name"}})
    assert listing(client)["total"] == 0

    started = client.post(f"/api/public/forms/{form['slug']}/responses/start").json()
    url = f"/api/public/responses/{started['response_id']}"
    client.patch(url, json={"token": started["token"], "answers": {str(email["id"]): "partial@example.com"}, "complete": False})
    assert listing(client)["total"] == 0
    done = client.patch(url, json={"token": started["token"], "answers": {str(email["id"]): "partial@example.com"}, "complete": True})
    assert done.status_code == 200
    assert emails(listing(client)) == ["partial@example.com"]


def test_auto_add_from_forms_skips_unfinished_responses(client, make_form, add_question) -> None:
    form, (email,) = published_form(client, add_question, make_form, "Survey", ("email", "Email"))
    started = client.post(f"/api/public/forms/{form['slug']}/responses/start").json()
    client.patch(
        f"/api/public/responses/{started['response_id']}",
        json={"token": started["token"], "answers": {str(email["id"]): "halfway@example.com"}, "complete": False},
    )
    assert client.post(f"{URL}/sync").json() == {"created": 0, "updated": 0}
    assert listing(client)["total"] == 0


def test_auto_add_from_forms_backfills_past_responses(client, make_form, add_question) -> None:
    form, (name, email) = published_form(client, add_question, make_form, "Survey", ("short_text", "Name"), ("email", "Email"))
    submit(client, form, [(name, "Dee"), (email, "dee@example.com")])
    submit(client, form, [(name, "Eve"), (email, "eve@example.com")])
    client.post(f"{URL}/bulk-delete", json={"ids": [c["id"] for c in listing(client)["items"]]})
    assert listing(client)["total"] == 0

    res = client.post(f"{URL}/sync")
    assert res.status_code == 200 and res.json() == {"created": 2, "updated": 0}
    assert set(emails(listing(client))) == {"dee@example.com", "eve@example.com"}
    assert client.post(f"{URL}/sync").json() == {"created": 0, "updated": 0}  # running it again changes nothing


# ---- export -----------------------------------------------------------------------------------------------------------


def test_export_is_a_csv_that_follows_the_search_and_cant_run_formulas(client) -> None:
    create(client, name="=HYPERLINK(\"http://evil\")", email="evil@example.com")
    create(client, name="Fine", email="fine@example.com")
    res = client.get(f"{URL}/export.csv", params={"query": "evil"})
    assert res.status_code == 200 and res.headers["content-type"].startswith("text/csv")
    assert "attachment" in res.headers["content-disposition"]
    text = res.content.decode("utf-8-sig")
    assert text.splitlines()[0].startswith("Name,Email,Phone,Company,Notes,Subscription status")
    assert "fine@example.com" not in text
    assert "'=HYPERLINK" in text
