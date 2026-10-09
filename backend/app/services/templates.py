"""The templates gallery: ready-made forms stored as JSON in app/templates/ (one file per template, file name = slug).

A template names its questions, endings and one gallery theme; "Use this template" builds a normal draft form from it
through the same service functions as manual editing (create_form, update_form, create_question, endings), so every
template is checked by the same models as a form made by hand and keeps working when those services change.
Logic and scoring are not part of templates yet (docs/superpowers/DEFERRED.md).
"""

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from pydantic import Field, ValidationError, model_validator
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.models import Form, QuestionType
from app.models.theme import ThemeGallery
from app.schemas.common import StrictModel, Title
from app.schemas.ending import EndingCreate, EndingUpdate
from app.schemas.form import FORM_DESCRIPTION_MAX, FormCreate, FormUpdate, ThankYou, Theme, Welcome
from app.schemas.properties import validate_properties
from app.schemas.question import QUESTION_DESCRIPTION_MAX, QUESTION_TITLE_MAX, QuestionCreate
from app.schemas.template import TemplateDetail, TemplateEndingPreview, TemplateQuestionPreview, TemplateSummary, TemplateTagsOut
from app.services import endings as ending_service
from app.services import forms as form_service
from app.services import questions as question_service

TEMPLATES_DIR = Path(__file__).resolve().parent.parent / "templates"

# Typeform's gallery categories (docs/design/typeform-free-features-audit.md, section 6): slug -> label.
ROLES = {"sales": "Sales", "product": "Product", "marketing": "Marketing", "hr": "HR", "customer-success": "Customer success"}
GOALS = {
    "get-feedback": "Get feedback",
    "make-sales": "Make sales",
    "plan-events": "Plan events",
    "conduct-research": "Conduct research",
    "engage-audience": "Engage audience",
    "recruit-talent": "Recruit talent",
    "generate-leads": "Generate leads",
}
FORM_TYPES = {"forms": "Forms", "surveys": "Surveys", "quizzes": "Quizzes", "polls": "Polls"}

# The gallery themes (seed.py `_seed_themes`) as (question, answer, button, background, font). Templates name a theme;
# the database gallery wins when it has that name, and this table makes templates work on an unseeded database.
_GALLERY: dict[str, tuple[str, str, str, str, str]] = {
    "Default (Light)": ("#2A222B", "#2A222B", "#2A222B", "#FAFAFA", "Inter"),
    "Midnight": ("#FFFFFF", "#FFFFFF", "#4D3DF7", "#1E1E1E", "System"),
    "Sunset": ("#4A154B", "#4A154B", "#E01E5A", "#FCECD4", "Georgia"),
    "Ocean": ("#004D40", "#004D40", "#009688", "#E0F2F1", "Inter"),
    "Forest": ("#1B5E20", "#1B5E20", "#4CAF50", "#E8F5E9", "Courier"),
    "Rose": ("#880E4F", "#880E4F", "#E91E63", "#FCE4EC", "System"),
    "Lavender": ("#4A148C", "#4A148C", "#9C27B0", "#F3E5F5", "Inter"),
    "Coffee": ("#3E2723", "#3E2723", "#795548", "#EFEBE9", "Georgia"),
    "Sky": ("#01579B", "#01579B", "#03A9F4", "#E1F5FE", "Inter"),
    "Mustard": ("#F57F17", "#F57F17", "#FFB300", "#FFFDE7", "System"),
    "Slate": ("#263238", "#263238", "#607D8B", "#ECEFF1", "Courier"),
    "Mint": ("#004D40", "#004D40", "#26A69A", "#E0F2F1", "Inter"),
    "Peach": ("#BF360C", "#BF360C", "#FF5722", "#FBE9E7", "Georgia"),
    "Plum": ("#4A148C", "#4A148C", "#AB47BC", "#F3E5F5", "Inter"),
    "Coral": ("#E65100", "#E65100", "#FF7043", "#FFF3E0", "System"),
    "Teal": ("#006064", "#006064", "#00BCD4", "#E0F7FA", "Inter"),
    "Olive": ("#33691E", "#33691E", "#8BC34A", "#F1F8E9", "Courier"),
    "Berry": ("#880E4F", "#880E4F", "#D81B60", "#FCE4EC", "System"),
    "Azure": ("#0D47A1", "#0D47A1", "#1976D2", "#E3F2FD", "Inter"),
    "Brick": ("#B71C1C", "#B71C1C", "#F44336", "#FFEBEE", "Georgia"),
    "Sand": ("#3E2723", "#3E2723", "#8D6E63", "#EFEBE9", "System"),
    "Sage": ("#1B5E20", "#1B5E20", "#81C784", "#E8F5E9", "Inter"),
    "Lilac": ("#4A148C", "#4A148C", "#BA68C8", "#F3E5F5", "Courier"),
    "Bronze": ("#E65100", "#E65100", "#FF9800", "#FFF3E0", "Georgia"),
    "Moss": ("#33691E", "#33691E", "#AED581", "#F1F8E9", "Inter"),
    "Ruby": ("#B71C1C", "#B71C1C", "#E53935", "#FFEBEE", "System"),
    "Charcoal": ("#212121", "#212121", "#424242", "#FAFAFA", "Inter"),
    "Navy": ("#1A237E", "#1A237E", "#3F51B5", "#E8EAF6", "Georgia"),
    "Cyan": ("#006064", "#006064", "#00ACC1", "#E0F7FA", "Courier"),
    "Gold": ("#F57F17", "#F57F17", "#FBC02D", "#FFFDE7", "System"),
}
FALLBACK_THEMES: dict[str, Theme] = {
    name: Theme(question=q, answer=a, button=b, background=bg, font=font) for name, (q, a, b, bg, font) in _GALLERY.items()
}


# ---- the template file format --------------------------------------------------------------------------------------


class TemplateTags(StrictModel):
    role: list[str] = Field(min_length=1)
    goal: list[str] = Field(min_length=1)
    type: list[str] = Field(min_length=1)

    @model_validator(mode="after")
    def _known_categories(self):
        for tags, known in ((self.role, ROLES), (self.goal, GOALS), (self.type, FORM_TYPES)):
            unknown = [t for t in tags if t not in known]
            if unknown:
                raise ValueError(f"unknown tag(s) {unknown}; use one of {sorted(known)}")
            if len(set(tags)) != len(tags):
                raise ValueError("tags must not repeat")
        return self


class TemplateQuestion(StrictModel):
    type: QuestionType
    title: str = Field(min_length=1, max_length=QUESTION_TITLE_MAX)
    description: str | None = Field(default=None, max_length=QUESTION_DESCRIPTION_MAX)
    required: bool = False
    # Omitted -> the type's defaults, exactly as when a creator adds the question.
    properties: dict[str, Any] | None = None

    @model_validator(mode="after")
    def _valid_properties(self):
        if self.properties is not None:
            try:
                validate_properties(self.type, self.properties)
            except ValidationError as exc:
                raise ValueError(f"invalid properties for {self.type}: {exc}") from exc
        return self


class TemplateDef(StrictModel):
    slug: str = Field(pattern=r"^[a-z0-9]+(-[a-z0-9]+)*$", max_length=64)
    title: Title
    description: str = Field(min_length=1, max_length=FORM_DESCRIPTION_MAX)
    tags: TemplateTags
    # Name of a gallery theme (see _GALLERY).
    theme: str
    welcome: Welcome | None = None
    questions: list[TemplateQuestion] = Field(min_length=1)
    endings: list[EndingCreate] = Field(min_length=1)

    @model_validator(mode="after")
    def _known_theme(self):
        if self.theme not in FALLBACK_THEMES:
            raise ValueError(f"unknown theme {self.theme!r}; use one of {sorted(FALLBACK_THEMES)}")
        return self


@lru_cache
def _load_all() -> dict[str, TemplateDef]:
    templates: dict[str, TemplateDef] = {}
    for path in sorted(TEMPLATES_DIR.glob("*.json")):
        try:
            definition = TemplateDef.model_validate(json.loads(path.read_text(encoding="utf-8")))
        except (ValidationError, ValueError) as exc:
            raise ValueError(f"Template file {path.name} is invalid: {exc}") from exc
        if definition.slug != path.stem:
            raise ValueError(f"Template file {path.name} must be named after its slug {definition.slug!r}")
        templates[definition.slug] = definition
    return templates


def get_template(slug: str) -> TemplateDef:
    template = _load_all().get(slug)
    if template is None:
        raise NotFoundError("Template not found")
    return template


# ---- gallery -------------------------------------------------------------------------------------------------------


def _gallery_themes(db: Session) -> dict[str, Theme]:
    """Themes by name: the database gallery first, the built-in table for names it doesn't have."""
    themes = dict(FALLBACK_THEMES)
    for row in db.scalars(select(ThemeGallery).order_by(ThemeGallery.id.desc())):
        try:
            themes[row.name] = Theme.model_validate(row.theme)
        except ValidationError:
            continue  # a gallery entry this schema can't read: keep the built-in colors
    return themes


def _summary(template: TemplateDef, themes: dict[str, Theme]) -> dict[str, Any]:
    return {
        "slug": template.slug,
        "title": template.title,
        "description": template.description,
        "tags": TemplateTagsOut(**template.tags.model_dump()),
        "question_count": len(template.questions),
        "question_types": list(dict.fromkeys(q.type for q in template.questions)),
        "theme_name": template.theme,
        "theme": themes[template.theme],
    }


def _wanted(values: list[str] | None) -> set[str] | None:
    cleaned = {v.strip().lower() for v in values or [] if v.strip()}
    return cleaned or None


def _matches(template: TemplateDef, role: set[str] | None, goal: set[str] | None, kind: set[str] | None, needle: str) -> bool:
    # Within one category any of the chosen values matches; across categories all must.
    if role is not None and not role & set(template.tags.role):
        return False
    if goal is not None and not goal & set(template.tags.goal):
        return False
    if kind is not None and not kind & set(template.tags.type):
        return False
    if needle:
        haystack = " ".join([template.title, template.description, *(q.title for q in template.questions)]).lower()
        return needle in haystack
    return True


def list_templates(
    db: Session,
    *,
    role: list[str] | None = None,
    goal: list[str] | None = None,
    form_type: list[str] | None = None,
    q: str | None = None,
) -> list[TemplateSummary]:
    roles, goals, kinds = _wanted(role), _wanted(goal), _wanted(form_type)
    needle = (q or "").strip().lower()
    themes = _gallery_themes(db)
    found = [t for t in _load_all().values() if _matches(t, roles, goals, kinds, needle)]
    found.sort(key=lambda t: (t.title.lower(), t.slug))
    return [TemplateSummary(**_summary(t, themes)) for t in found]


def template_detail(db: Session, slug: str) -> TemplateDetail:
    template = get_template(slug)
    return TemplateDetail(
        **_summary(template, _gallery_themes(db)),
        questions=[
            TemplateQuestionPreview(
                type=q.type, title=q.title, description=q.description, required=q.required and q.type != QuestionType.STATEMENT
            )
            for q in template.questions
        ],
        endings=[TemplateEndingPreview(title=e.title, message=e.message) for e in template.endings],
    )


# ---- use a template ------------------------------------------------------------------------------------------------


def create_form_from_template(db: Session, slug: str) -> Form:
    """A new draft form with the template's questions, endings, welcome button and theme."""
    template = get_template(slug)
    theme = _gallery_themes(db)[template.theme]
    form = form_service.create_form(db, FormCreate(title=template.title))
    form_id = form.id
    try:
        _fill_form(db, form, template, theme)
    except Exception:
        # Never leave a half-built form in the workspace.
        db.rollback()
        leftover = db.get(Form, form_id)
        if leftover is not None:
            form_service.delete_form(db, leftover)
        raise
    return form


def _fill_form(db: Session, form: Form, template: TemplateDef, theme: Theme) -> None:
    first, *more = template.endings
    changes: dict[str, Any] = {
        "description": template.description,
        "theme": theme,
        "welcome": template.welcome or Welcome(),
    }
    if "thank_you" in FormUpdate.model_fields:
        # Previews that fall back to the legacy single thank-you screen show the first ending's wording.
        changes["thank_you"] = ThankYou(
            title=first.title, message=first.message, button_text=first.button_text, button_url=first.button_url
        )
    form_service.update_form(db, form, FormUpdate(**changes))

    for question in template.questions:
        question_service.create_question(
            db,
            form,
            QuestionCreate(
                type=question.type,
                title=question.title,
                description=question.description,
                required=question.required,
                properties=question.properties,
            ),
        )

    # A new form already has one default ending; the template's first ending takes its place.
    default_ending = form.endings[0]
    ending_service.update_ending(db, default_ending.id, EndingUpdate.model_validate(first.model_dump(exclude_unset=True)))
    for ending in more:
        # The session keeps its loaded `endings` list across commits; reload it so positions continue after the last one.
        db.expire(form, ["endings"])
        ending_service.create_ending(db, form.id, ending)
    db.expire(form, ["endings", "questions"])
