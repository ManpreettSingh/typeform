"""Simultaneous writes to one form must not collide on UNIQUE(form_id, position).

SQLite starts a write transaction lazily, so two requests could read the same question list, pick the same position
and the loser got a 500. Transactions now begin IMMEDIATE (app/core/db.py), which makes them take turns.
"""

import threading

from fastapi.testclient import TestClient

from app.main import app

TYPES = ["short_text", "long_text", "multiple_choice", "dropdown", "email", "number", "yes_no", "rating"]


def _at_once(calls):
    barrier = threading.Barrier(len(calls))
    results: list = [None] * len(calls)

    def run(i, fn):
        barrier.wait()
        results[i] = fn()

    threads = [threading.Thread(target=run, args=(i, fn)) for i, fn in enumerate(calls)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def test_simultaneous_question_creates_all_succeed_in_distinct_positions(make_form):
    form = make_form()
    clients = [TestClient(app, raise_server_exceptions=False) for _ in TYPES]
    responses = _at_once(
        [lambda c=c, t=t: c.post(f"/api/forms/{form['id']}/questions", json={"type": t, "title": t}) for c, t in zip(clients, TYPES)]
    )
    assert [r.status_code for r in responses] == [201] * len(TYPES), [r.text for r in responses if r.status_code != 201]

    questions = clients[0].get(f"/api/forms/{form['id']}").json()["questions"]
    assert sorted(q["title"] for q in questions) == sorted(TYPES)
    assert [q["position"] for q in questions] == list(range(len(TYPES)))


def test_simultaneous_ending_creates_all_succeed(make_form):
    form = make_form()
    clients = [TestClient(app, raise_server_exceptions=False) for _ in range(6)]
    responses = _at_once([lambda c=c, i=i: c.post(f"/api/forms/{form['id']}/endings", json={"title": f"End {i}"}) for i, c in enumerate(clients)])
    assert all(r.status_code in (200, 201) for r in responses), [r.text for r in responses]
    endings = clients[0].get(f"/api/forms/{form['id']}").json()["endings"]
    assert [e["position"] for e in endings] == list(range(7))
