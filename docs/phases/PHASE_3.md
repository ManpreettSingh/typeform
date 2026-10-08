# Phase 3 — Builder I: Structure & Question Editing

## Objective
Working builder shell where questions of all 8 types can be added, edited, deleted, and saved.

## Read first
`DESIGN_SYSTEM.md` (Builder), `DATABASE_SCHEMA.md` (properties), `API_SPEC.md` (Questions)

## Tasks
1. Route `/forms/[id]/edit`; fetch form + questions into Zustand `builderStore` (questions[], selectedId, saveState).
2. Top bar: inline-editable form title (debounced PATCH), tabs (Create | Results | Share), Publish/Unpublish button, save indicator.
3. Left panel: numbered question list with type icon + truncated title; click selects; "+ Add question" opens type-picker popover (8 types, icons, labels).
4. Right panel (settings for selected question): title, description, required toggle, type-specific editors:
   - choice/dropdown: add/remove/edit options (inline), allow multiple (choice)
   - rating: max 3–10
   - number: min/max · text: placeholder/max length
5. Delete question (confirm if has answers is optional).
6. Debounced autosave (PATCH per question), optimistic UI, rollback + toast on failure.
7. Center: simple static preview of the selected question (replaced by real preview in Phase 4).
8. Empty-state when no questions.

## Acceptance criteria
- [ ] All 8 types can be added with sensible defaults
- [ ] Edits autosave and persist after refresh
- [ ] Required + description stored
- [ ] Options editor handles add/remove/rename, min 1–2 options enforced
- [ ] Save indicator reflects state
- [ ] `PROGRESS.md` updated

## Out of scope
Drag-drop, live preview fidelity, theme settings.
