# Project Brief — Typeform Builder (SDE Fullstack Assignment)

Build a functional clone of Typeform: builder, shareable public link, one-question-at-a-time respondent flow, results view.
**No auth. No premium features.** Assume a single default creator.

## Stack (mandatory)
- Frontend: Next.js (TypeScript)
- Backend: Python, FastAPI (or Django) — we use **FastAPI**
- DB: SQLite, own schema (schema design is evaluated)

## Must-have features
1. **Form Builder** — title + ordered questions; add/edit/reorder (drag-drop)/delete; types: short text, long text, multiple choice, dropdown, email, number, yes/no, rating; per-question required toggle + description; live preview.
2. **Form Management** — list with status (draft/published) + response count; create, rename, duplicate, delete; publish/unpublish with shareable link; all persisted.
3. **Respondent Flow** — public, no login; one question at a time, full-screen, smooth transitions; Enter/arrow keyboard nav; progress indicator; client + server validation; submit stores response; thank-you screen.
4. **Results** — per-form responses table; individual response view; per-question summary stats (e.g. choice counts); persisted.
5. **Typeform feel** — conversational UI, clean builder with live preview, modals, inline editing, toasts, settings placeholders (theme, thank-you screen).

## Placeholders allowed ("Coming Soon")
Advanced logic/branching (basic branching = bonus), integrations/webhooks, team collaboration, payment/file-upload types, real auth.

## Bonus
Logic jumps, custom themes, CSV export, partial-response tracking / completion rate, file-upload type, dark mode.

## Deliverables / rules
- **Seed data**: a couple of published forms, mixed question types, existing responses.
- **README**: setup, stack, architecture overview, DB schema, assumptions.
- Original work only (plagiarism = disqualification).
- UI should closely resemble Typeform.

## Evaluation
Functionality (builder + respondent flow most important) · UI/UX similarity · DB design · API design · Code quality.
