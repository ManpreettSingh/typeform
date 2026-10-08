# Phase 4 — Builder II: Drag-drop, Live Preview, Settings

## Objective
Complete builder: reorder, faithful live preview, settings placeholders.

## Tasks
1. dnd-kit sortable on left question list (drag handle, keyboard accessible, drag overlay); on drop → optimistic reorder + `PUT /questions/order`; rollback on error.
2. Build the **shared respondent components** now (`components/respondent/QuestionRenderer` and one component per type) — presentational, controlled, with `mode="preview" | "live"`. (Full flow logic comes in Phase 5.)
3. Center pane renders selected question using these components; updates instantly as settings change.
4. "Preview" button → full-screen preview modal running a local (non-persisting) flow of the unsaved/current questions.
5. Settings tab (top-level) with: Theme (colors/font preview, mostly placeholder, applies to preview), Thank-you screen (title/message editable and saved to `forms.thank_you`), Logic/Integrations/Collaborate = "Coming soon".
6. Add-between: "+" insert at specific position (optional).

## Acceptance criteria
- [ ] Reorder works with mouse + keyboard and persists
- [ ] Preview matches what respondents will see (same components)
- [ ] Thank-you settings persist
- [ ] Placeholders are clearly "Coming soon"
- [ ] `PROGRESS.md` updated
