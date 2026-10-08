# Phase 2 — Dashboard / Form Management UI

## Objective
Creator's home: list and manage forms.

## Read first
`DESIGN_SYSTEM.md` (Dashboard), `API_SPEC.md` (Forms)

## Tasks
1. Layout: top nav (logo, "Create form"), default-creator avatar placeholder.
2. Forms list (`/forms`) via TanStack Query: card/list rows with title, status badge, response count, updated time, thumbnail-style placeholder.
3. Create form → POST, redirect to `/forms/{id}/edit`.
4. ⋯ menu per form: Rename (modal or inline), Duplicate, Delete (ConfirmDialog), Publish/Unpublish.
5. Share: when published show link `/f/{slug}` with Copy button + toast.
6. Click card → builder; "Results" shortcut → results page.
7. Search/filter by title; sort by updated (optional).
8. Loading skeletons, empty state, error state; optimistic updates for rename/delete.
9. Toasts for every action.

## Acceptance criteria
- [ ] Create, rename, duplicate, delete, publish/unpublish work and persist after refresh
- [ ] Status + response count correct
- [ ] Copy link works
- [ ] Empty/loading/error states present
- [ ] `PROGRESS.md` updated

## Out of scope
Builder internals.
