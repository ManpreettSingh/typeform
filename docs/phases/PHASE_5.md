# Phase 5 — Respondent Flow (public)

## Objective
The signature experience. Highest-weight phase — spend the most care here.

## Read first
`DESIGN_SYSTEM.md` (Motion, Respondent), `API_SPEC.md` (Public), validation rules

## Backend
1. `GET /api/public/forms/{slug}` (published only; 404 otherwise).
2. `POST /api/public/forms/{slug}/responses`: validate every answer per rules in `API_SPEC.md`, reject unknown ids, return per-question errors (422); persist response (completed) + answers in one transaction.
3. `services/validation.py` + tests.

## Frontend (`/f/[slug]`)
4. State machine: `welcome (optional) → question[i] → … → submitting → thank-you`. Answers kept in a reducer.
5. Full-screen layout, centered question, question number + arrow, title, description, input per type; choice options labeled A/B/C with letter shortcuts; yes/no with Y/N; rating clickable + number keys; dropdown searchable/keyboard friendly.
6. Transitions with framer-motion (AnimatePresence, direction-aware).
7. Keyboard: Enter = next (Shift+Enter in long text for newline), ↑/↓ or buttons for prev/next, Esc safe.
8. Progress bar (answered/total) + "n of N".
9. Client validation mirrored in `lib/validation.ts`; inline error with shake/message; required blocks advance; optional can be skipped.
10. Last question → "Submit" → POST; handle server 422 by jumping to the offending question; network error toast + retry.
11. Thank-you screen from `forms.thank_you`; prevent double submit.
12. States: loading, not found/unpublished, already-submitted (optional), mobile responsive.
13. Prevent focus loss: autofocus the active input after each transition.

## Acceptance criteria
- [ ] Draft form is not accessible; published form is, with no login
- [ ] All 8 types fillable by keyboard only
- [ ] Transitions smooth in both directions; reduced-motion respected
- [ ] Required/email/number/rating validation on client AND server (test by bypassing client)
- [ ] Submission persists; thank-you shows
- [ ] Works at mobile width
- [ ] `PROGRESS.md` updated
