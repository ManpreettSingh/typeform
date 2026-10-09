"""Seeds demo data: two published forms with responses and one draft.

Idempotent: forms are keyed by fixed slugs and skipped if present; demo responses are only added to a
seeded form that has none. Responses are generated from a fixed random seed (same data on every machine)
and pass through the real answer validation, so they always follow each form's branching.

Run from backend/:  python -m app.seed
"""

import random
from collections.abc import Callable
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.core.db import Base, SessionLocal, engine
from app.models import Answer, Form, FormStatus, Question, QuestionType, Response, ResponseStatus
from app.models.base import utcnow
from app.schemas.form import ThankYou, Theme
from app.schemas.properties import validate_properties
from app.services.logic import visited_path
from app.services.validation import validate_answers

# A question: key (used by rules and answer generators), type, title, required, properties, and optionally
# "description" and "logic" (rules with `to` as another question's key or "end").
QuestionSpec = dict[str, Any]
# Builds one respondent's answers, keyed by question key (unanswered keys may be missing).
AnswerFactory = Callable[[random.Random], dict[str, Any]]

T = QuestionType

FIRST_NAMES = [
    "Priya", "Marco", "Aiko", "Sam", "Lena", "Tomás", "Grace", "Omar", "Chen", "Fatima", "Lucas", "Zoe",
    "Ibrahim", "Hannah", "Mateo", "Nia", "Arjun", "Elena", "Kofi", "Sofia", "Yuki", "Daniel", "Amara",
    "Felix", "Leila", "Noah", "Ines", "Ravi", "Maya", "Jonas", "Ada", "Diego", "Mei", "Oscar", "Hana",
]
LAST_NAMES = [
    "Sharma", "Rossi", "Tanaka", "Okafor", "Novak", "García", "Hopper", "Haddad", "Wei", "Khan", "Silva",
    "Müller", "Mensah", "Lindqvist", "Costa", "Park", "Dubois", "Iyer", "Nakamura", "Kowalski", "Reyes",
]
DOMAINS = ["gmail.com", "outlook.com", "proton.me", "example.com", "fastmail.com"]


def _person(rng: random.Random) -> tuple[str, str]:
    first, last = rng.choice(FIRST_NAMES), rng.choice(LAST_NAMES)
    return f"{first} {last}", f"{first}.{last}".lower().replace("á", "a").replace("ü", "u").replace("í", "i")


def _sometimes(rng: random.Random, chance: float, value: Any) -> Any:
    return value if rng.random() < chance else None


# ---- Customer Feedback ------------------------------------------------------

FEEDBACK_FRUSTRATIONS = [
    "Reordering long forms on a small laptop screen was fiddly.",
    "I couldn't find where to change the thank-you message at first.",
    "Would love to upload images to questions.",
    "The results page took a moment to show my newest response.",
    "I wanted to set a closing date for the form.",
    "Exporting to CSV opened in the wrong program on my machine.",
    "Choice labels got cut off on my phone.",
]
FEEDBACK_SOURCES = ["search", "friend", "social", "blog", "conference", "other"]


def _feedback_answers(rng: random.Random) -> dict[str, Any]:
    name, handle = _person(rng)
    nps = rng.choices(range(1, 11), weights=[1, 1, 1, 2, 3, 4, 7, 9, 8, 6])[0]
    frustrated = rng.random() < (0.75 if nps <= 6 else 0.3)
    features = sorted(rng.sample(["builder", "logic", "themes", "results", "csv"], rng.randint(1, 3)))
    return {
        "name": name.split()[0],
        "nps": nps,
        "features": _sometimes(rng, 0.9, features),
        "frustrated": frustrated,
        "frustration": rng.choice(FEEDBACK_FRUSTRATIONS),
        "source": rng.choices(FEEDBACK_SOURCES, weights=[6, 5, 4, 2, 2, 1])[0],
        "email": _sometimes(rng, 0.55, f"{handle}@{rng.choice(DOMAINS)}"),
    }


FEEDBACK: dict[str, Any] = {
    "slug": "demo-feedback",
    "title": "Customer Feedback",
    "description": "Tell us how we're doing — it takes about a minute.",
    "theme": Theme().model_dump(),
    "thank_you": {
        "title": "Thanks for the feedback!",
        "message": "Every answer is read by our product team.",
        "button_text": None,
        "button_url": None,
    },
    "questions": [
        {"key": "name", "type": T.SHORT_TEXT, "title": "First things first — what's your first name?",
         "required": True, "properties": {"placeholder": "Type your answer here..."}},
        {"key": "nps", "type": T.RATING, "title": "How likely are you to recommend us to a friend?",
         "required": True, "properties": {"max": 10, "shape": "number"},
         "description": "1 = not at all likely, 10 = extremely likely"},
        {"key": "features", "type": T.MULTIPLE_CHOICE, "title": "Which features do you use most?",
         "required": False, "properties": {"allow_multiple": True, "options": [
             {"id": "builder", "label": "Form builder"},
             {"id": "logic", "label": "Logic jumps"},
             {"id": "themes", "label": "Themes"},
             {"id": "results", "label": "Results & charts"},
             {"id": "csv", "label": "CSV export"},
         ]}},
        {"key": "frustrated", "type": T.YES_NO, "title": "Did anything frustrate you along the way?",
         "required": True, "properties": {}, "logic": [{"op": "is", "value": False, "to": "source"}]},
        {"key": "frustration", "type": T.LONG_TEXT, "title": "Sorry to hear that. What happened?",
         "required": True, "properties": {"max_length": 1000}},
        {"key": "source", "type": T.DROPDOWN, "title": "How did you hear about us?", "required": True,
         "properties": {"options": [
             {"id": "search", "label": "Search engine"},
             {"id": "friend", "label": "Friend or colleague"},
             {"id": "social", "label": "Social media"},
             {"id": "blog", "label": "Blog post"},
             {"id": "conference", "label": "Conference or meetup"},
             {"id": "other", "label": "Other"},
         ]}},
        {"key": "email", "type": T.EMAIL, "title": "Can we follow up with you? Leave your email.",
         "required": False, "properties": {}, "description": "Optional — we'll only use it to reply."},
    ],
    "responses": {"count": 30, "partial": 4, "factory": _feedback_answers, "seed": 5},
}

# ---- Event Registration -------------------------------------------------------

EVENT_NOTES = [
    "I use a wheelchair — is the venue step-free?",
    "Could I get an invoice for my company?",
    "Arriving late on day one because of my flight.",
    "Happy to volunteer during the breaks!",
    "Is there a quiet room available?",
    "Will the talks be recorded?",
]


def _event_answers(rng: random.Random) -> dict[str, Any]:
    name, handle = _person(rng)
    ticket = rng.choices(["day", "full", "workshop"], weights=[3, 5, 2])[0]
    return {
        "name": name,
        "email": f"{handle}@{rng.choice(DOMAINS)}",
        "ticket": ticket,
        "guests": rng.choices(range(0, 4), weights=[10, 5, 2, 1])[0],
        "workshops": sorted(rng.sample(["design", "a11y", "perf", "testing"], rng.randint(1, 2))),
        "diet": rng.choices(["none", "vegetarian", "vegan", "gluten", "halal", "kosher"], weights=[10, 5, 2, 2, 1, 1])[0],
        "networking": rng.random() < 0.7,
        "notes": _sometimes(rng, 0.3, rng.choice(EVENT_NOTES)),
    }


EVENT: dict[str, Any] = {
    "slug": "demo-event",
    "title": "Event Registration — Frontend Summit",
    "description": "Two days of talks and workshops in Lisbon, 14–15 November. Grab your spot below.",
    "theme": {"background": "#0F2D25", "question": "#F3F1EA", "answer": "#F3F1EA", "button": "#E8B04B", "font": "Georgia", "background_image": None},
    "thank_you": {
        "title": "You're on the list 🎉",
        "message": "We've saved your spot. Your ticket and venue details are on their way.",
        "button_text": "See the schedule",
        "button_url": "https://example.com/schedule",
    },
    "questions": [
        {"key": "name", "type": T.SHORT_TEXT, "title": "What's your full name?", "required": True,
         "properties": {"placeholder": "Jane Doe"}},
        {"key": "email", "type": T.EMAIL, "title": "Which email should we send your ticket to?",
         "required": True, "properties": {}},
        {"key": "ticket", "type": T.MULTIPLE_CHOICE, "title": "Which ticket would you like?", "required": True,
         "properties": {"allow_multiple": False, "options": [
             {"id": "day", "label": "Day pass — talks only"},
             {"id": "full", "label": "Full conference — talks + workshops"},
             {"id": "workshop", "label": "Workshops only"},
         ]},
         "logic": [{"op": "is", "value": "day", "to": "guests"}]},
        {"key": "workshops", "type": T.MULTIPLE_CHOICE, "title": "Which workshops would you like to join?",
         "required": True, "description": "Pick up to two — seats are limited.",
         "properties": {"allow_multiple": True, "options": [
             {"id": "design", "label": "Design systems in practice"},
             {"id": "a11y", "label": "Accessibility audits"},
             {"id": "perf", "label": "Web performance deep dive"},
             {"id": "testing", "label": "Testing without tears"},
         ]}},
        {"key": "guests", "type": T.NUMBER, "title": "How many guests are you bringing to the evening party?",
         "required": True, "properties": {"min": 0, "max": 5}},
        {"key": "diet", "type": T.DROPDOWN, "title": "Any dietary requirements?", "required": True,
         "properties": {"options": [
             {"id": "none", "label": "None"},
             {"id": "vegetarian", "label": "Vegetarian"},
             {"id": "vegan", "label": "Vegan"},
             {"id": "gluten", "label": "Gluten-free"},
             {"id": "halal", "label": "Halal"},
             {"id": "kosher", "label": "Kosher"},
         ]}},
        {"key": "networking", "type": T.YES_NO, "title": "Will you join the networking dinner on day one?",
         "required": True, "properties": {}},
        {"key": "notes", "type": T.LONG_TEXT, "title": "Anything else we should know?", "required": False,
         "description": "Accessibility needs, questions, invoices…", "properties": {"max_length": 500}},
    ],
    "responses": {"count": 22, "partial": 3, "factory": _event_answers, "seed": 21},
}

# ---- Draft --------------------------------------------------------------------

DRAFT: dict[str, Any] = {
    "slug": "demo-draft",
    "title": "Product Survey (draft)",
    "description": None,
    "status": FormStatus.DRAFT,
    "theme": Theme().model_dump(),
    "thank_you": ThankYou().model_dump(),
    "questions": [
        {"key": "role", "type": T.DROPDOWN, "title": "What best describes your role?", "required": True,
         "properties": {"options": [
             {"id": "pm", "label": "Product manager"},
             {"id": "eng", "label": "Engineer"},
             {"id": "design", "label": "Designer"},
             {"id": "other", "label": "Something else"},
         ]}},
        {"key": "love", "type": T.RATING, "title": "How much do you love the new dashboard?", "required": False,
         "properties": {"max": 5, "shape": "heart"}},
        {"key": "wish", "type": T.SHORT_TEXT, "title": "If you could add one thing, what would it be?",
         "required": False, "properties": {}},
    ],
}

SEED_FORMS = [FEEDBACK, EVENT, DRAFT]


def _seed_form(db: Session, spec: dict[str, Any]) -> Form | None:
    """Creates the form unless its slug exists; returns the new form or None."""
    if db.scalar(select(Form.id).where(Form.slug == spec["slug"])) is not None:
        return None
    status = spec.get("status", FormStatus.PUBLISHED)
    specs: list[QuestionSpec] = spec["questions"]
    form = Form(
        slug=spec["slug"],
        title=spec["title"],
        description=spec["description"],
        status=status,
        published_at=utcnow() - timedelta(days=35) if status == FormStatus.PUBLISHED else None,
        theme=Theme.model_validate(spec["theme"]).model_dump(),
        thank_you=ThankYou.model_validate(spec["thank_you"]).model_dump(),
        questions=[
            Question(
                type=q["type"],
                title=q["title"],
                description=q.get("description"),
                required=q["required"],
                position=position,
                properties=validate_properties(q["type"], q["properties"]),
            )
            for position, q in enumerate(specs)
        ],
    )
    db.add(form)
    db.flush()

    # Rules name questions by key; store them with real ids now that the questions have them.
    ids = {q["key"]: question.id for q, question in zip(specs, form.questions, strict=True)}
    for q, question in zip(specs, form.questions, strict=True):
        if q.get("logic"):
            question.logic = {"rules": [{**rule, "to": ids.get(rule["to"], rule["to"])} for rule in q["logic"]]}
    db.flush()
    return form


def _demo_response(form: Form, keys: list[str], values: dict[str, Any], partial: bool, rng: random.Random):
    """Validated answers for one respondent; a partial one stops part-way along its path."""
    by_id = {str(q.id): values[key] for q, key in zip(form.questions, keys, strict=True) if values.get(key) is not None}
    cleaned = validate_answers(form.questions, by_id)
    if not partial:
        return cleaned
    path = [form.questions[i].id for i in visited_path(form.questions, cleaned)]
    kept = path[: rng.randint(1, max(1, len(path) - 2))]
    return {qid: value for qid, value in cleaned.items() if qid in kept}


def _seed_responses(db: Session, form: Form, spec: dict[str, Any]) -> int:
    """Adds generated responses, but only to a form that has none (never mixes with real data)."""
    config = spec.get("responses")
    if not config or db.scalar(select(func.count(Response.id)).where(Response.form_id == form.id)):
        return 0
    rng = random.Random(config["seed"])
    keys = [q["key"] for q in spec["questions"]]
    now = utcnow()
    for i in range(config["count"]):
        # The last few are the partial ones: started recently, never submitted.
        partial = i >= config["count"] - config["partial"]
        started = now - timedelta(days=rng.uniform(0.2, 2) if partial else rng.uniform(0.5, 30))
        answers = _demo_response(form, keys, config["factory"](rng), partial, rng)
        db.add(
            Response(
                form_id=form.id,
                status=ResponseStatus.PARTIAL if partial else ResponseStatus.COMPLETED,
                started_at=started,
                submitted_at=None if partial else started + timedelta(seconds=rng.randint(45, 420)),
                answers=[Answer(question_id=qid, value=value) for qid, value in answers.items()],
            )
        )
    return config["count"]


def _seed_themes(db: Session) -> int:
    from app.models.theme import ThemeGallery
    from app.schemas.form import Theme
    if db.scalar(select(func.count(ThemeGallery.id))) >= 30:
        return 0
    
    themes_data = [
        ("Default (Light)", "#2A222B", "#2A222B", "#2A222B", "#FAFAFA", "Inter"),
        ("Midnight", "#FFFFFF", "#FFFFFF", "#4D3DF7", "#1E1E1E", "System"),
        ("Sunset", "#4A154B", "#4A154B", "#E01E5A", "#FCECD4", "Georgia"),
        ("Ocean", "#004D40", "#004D40", "#009688", "#E0F2F1", "Inter"),
        ("Forest", "#1B5E20", "#1B5E20", "#4CAF50", "#E8F5E9", "Courier"),
        ("Rose", "#880E4F", "#880E4F", "#E91E63", "#FCE4EC", "System"),
        ("Lavender", "#4A148C", "#4A148C", "#9C27B0", "#F3E5F5", "Inter"),
        ("Coffee", "#3E2723", "#3E2723", "#795548", "#EFEBE9", "Georgia"),
        ("Sky", "#01579B", "#01579B", "#03A9F4", "#E1F5FE", "Inter"),
        ("Mustard", "#F57F17", "#F57F17", "#FFB300", "#FFFDE7", "System"),
        ("Slate", "#263238", "#263238", "#607D8B", "#ECEFF1", "Courier"),
        ("Mint", "#004D40", "#004D40", "#26A69A", "#E0F2F1", "Inter"),
        ("Peach", "#BF360C", "#BF360C", "#FF5722", "#FBE9E7", "Georgia"),
        ("Plum", "#4A148C", "#4A148C", "#AB47BC", "#F3E5F5", "Inter"),
        ("Coral", "#E65100", "#E65100", "#FF7043", "#FFF3E0", "System"),
        ("Teal", "#006064", "#006064", "#00BCD4", "#E0F7FA", "Inter"),
        ("Olive", "#33691E", "#33691E", "#8BC34A", "#F1F8E9", "Courier"),
        ("Berry", "#880E4F", "#880E4F", "#D81B60", "#FCE4EC", "System"),
        ("Azure", "#0D47A1", "#0D47A1", "#1976D2", "#E3F2FD", "Inter"),
        ("Brick", "#B71C1C", "#B71C1C", "#F44336", "#FFEBEE", "Georgia"),
        ("Sand", "#3E2723", "#3E2723", "#8D6E63", "#EFEBE9", "System"),
        ("Sage", "#1B5E20", "#1B5E20", "#81C784", "#E8F5E9", "Inter"),
        ("Lilac", "#4A148C", "#4A148C", "#BA68C8", "#F3E5F5", "Courier"),
        ("Bronze", "#E65100", "#E65100", "#FF9800", "#FFF3E0", "Georgia"),
        ("Moss", "#33691E", "#33691E", "#AED581", "#F1F8E9", "Inter"),
        ("Ruby", "#B71C1C", "#B71C1C", "#E53935", "#FFEBEE", "System"),
        ("Charcoal", "#212121", "#212121", "#424242", "#FAFAFA", "Inter"),
        ("Navy", "#1A237E", "#1A237E", "#3F51B5", "#E8EAF6", "Georgia"),
        ("Cyan", "#006064", "#006064", "#00ACC1", "#E0F7FA", "Courier"),
        ("Gold", "#F57F17", "#F57F17", "#FBC02D", "#FFFDE7", "System")
    ]
    
    count = 0
    for name, q, a, b, bg, font in themes_data:
        theme_obj = ThemeGallery(
            name=name,
            theme=Theme(
                question=q,
                answer=a,
                button=b,
                background=bg,
                font=font
            ).model_dump()
        )
        db.add(theme_obj)
        count += 1
    return count

def seed() -> tuple[int, int, int]:
    """Returns (forms created, responses created, themes created)."""
    Base.metadata.create_all(engine)
    from app.core.migrations import apply_migrations
    apply_migrations(engine)
    forms = responses = themes = 0
    with SessionLocal() as db:
        themes += _seed_themes(db)
        for spec in SEED_FORMS:
            form = _seed_form(db, spec)
            forms += form is not None
            form = form or db.scalar(select(Form).where(Form.slug == spec["slug"]))
            responses += _seed_responses(db, form, spec)
        db.commit()
    return forms, responses, themes


if __name__ == "__main__":
    forms, responses, themes = seed()
    print(f"Seeded {forms} new form(s), {responses} response(s), and {themes} theme(s).")
