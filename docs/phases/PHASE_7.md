# Phase 7 — Polish, Bonuses & Placeholders

Do bonuses in this priority order (stop when time runs out; each is independent):

1. **UX polish pass**: hover/focus states, consistent spacing, skeletons, error boundaries, favicon/title, 404 page, keyboard focus rings, responsive builder (collapse panels on small screens).
2. **Partial responses + completion rate**: `/responses/start` + PATCH on each advance; table shows partial vs completed.
3. **Custom themes**: background color/image-less, text/button colors, font choice; stored in `forms.theme`; applied to respondent + preview via CSS variables.
4. **Basic branching**: per-question rule `{if answer op value → jump to question_id | end}` stored in `questions.logic`; builder Logic panel (simple UI); respondent flow resolves next question; progress computed accordingly. Guard against cycles.
5. **Dark mode** for dashboard/builder (token swap).
6. **CSV export** (if not done in Phase 6).
7. Placeholder pages: Integrations, Collaborate, Payment/File upload types disabled with "Coming soon".

## Acceptance criteria
- [ ] Each shipped bonus works end-to-end and is listed in README
- [ ] No regressions in Phases 2–6 flows
- [ ] `PROGRESS.md` updated
