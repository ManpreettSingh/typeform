# PROGRESS

**Current phase:** Phase 3 — Builder I: Structure & Question Editing
**Last updated:** 2026-10-08
**Next action:** Run `phases/PHASE_3.md`

## Phase status
| # | Phase | Status |
|---|---|---|
| 0 | Foundation & scaffolding | ✅ Done |
| 1 | Database & Core Backend API | ✅ Done |
| 2 | Dashboard / Form Management | ✅ Done |
| 3 | Builder I — Structure & Question Editing | ⬜ |
| 4 | Builder II — Drag-drop, Live Preview, Settings | ⬜ |
| 5 | Respondent Flow (public) | ⬜ |
| 6 | Results & Analytics | ⬜ |
| 7 | Polish, Bonuses & Placeholders | ⬜ |
| 8 | Seed, README, QA & Submission | ⬜ |

## Feature checklist
### Form Management
- [x] List forms (status, response count)
- [x] Create / rename / duplicate / delete
- [x] Publish / unpublish + share link + copy
### Builder
- [ ] Title inline edit
- [ ] Add question (8 types)
- [ ] Edit title / description / required
- [ ] Options editor (choice, dropdown) / rating max
- [ ] Delete question
- [ ] Drag-and-drop reorder (persisted)
- [ ] Live preview
- [ ] Autosave + "Saved" indicator
- [ ] Settings placeholders (theme, thank-you screen)
### Respondent
- [ ] Public page by slug (published only)
- [ ] One-at-a-time full-screen + transitions
- [ ] Keyboard nav (Enter / arrows / letter shortcuts)
- [ ] Progress indicator
- [ ] Client validation
- [ ] Server validation
- [ ] Submit + thank-you
### Results
- [ ] Responses table
- [ ] Single response view
- [ ] Summary stats per question
### Experience
- [ ] Toasts, modals, empty/loading/error states (dashboard ✅; remaining screens pending)
- [ ] "Coming soon" placeholders
### Bonus
- [ ] Branching / logic jumps
- [ ] Custom themes
- [ ] CSV export
- [ ] Partial responses / completion rate
- [ ] Dark mode
### Submission
- [ ] Seed data (2+ published forms, responses)
- [ ] README (setup, stack, architecture, schema, assumptions)

## Session log
| Date | Phase | What was done | Issues / follow-ups |
|---|---|---|---|
| 2026-10-08 | 0 | FastAPI skeleton (app factory, CORS, `/api/health`, SQLite session w/ FK pragma, 3 pytest tests); Next.js 16 + Tailwind v4 app with design tokens, Inter, `lib/api.ts`, Query + Toaster providers, 9 UI primitives, `/` health page, `/dev/ui` showcase; root npm scripts, README stub, `.gitignore`, `.env.example`s | Health badge on `/` not checked in a real browser (CORS + endpoints verified via curl) |
| 2026-10-08 | 1 | Models (Form/Question/Response/Answer: CHECKs, cascades, indexes, UTC timestamps); per-type `properties` schemas + defaults; forms CRUD, duplicate, publish/unpublish; questions create/patch/delete; transactional reorder; `{detail}` error format incl. 422 `{detail:{errors}}`; `seed.py` (1 demo form, idempotent); 32 pytest tests on a temp DB; `lib/types.ts` | No frontend consumes the API yet (Phase 2) |
| 2026-10-08 | 2 | `/` → `/forms` dashboard: top nav + Create form modal (→ builder route); card grid (thumbnail, status, responses, relative updated time, copy link, Results link, ⋯ menu: open/results/share/copy link/rename/duplicate/publish-unpublish/delete); search + sort; Share modal (auto-opens after publish); optimistic rename/delete with rollback; toasts on every action; skeleton/empty/no-match/error+retry states. New primitives: Skeleton, EmptyState, Input `leftIcon`; Menu closes on route hide + restores focus. Stub pages for `/forms/[id]/edit` and `/results` | Verified with a 29-check headless Edge run (Playwright, throwaway DB) incl. persistence after refresh, clipboard, 390px layout. `/f/{slug}` link 404s until Phase 5 |

## Decisions & assumptions (feeds README)
- Default creator, no auth.
- **Tailwind v4** (create-next-app default): no `tailwind.config.ts`; tokens live only in `frontend/app/globals.css` (`:root` vars → `@theme inline` utilities like `bg-bg`, `text-text-muted`, `rounded-card`).
- **Next.js 16** with `cacheComponents` enabled (scaffold default). Check `frontend/node_modules/next/dist/docs/` for API changes before using Next APIs.
- Run scripts are root `package.json` npm scripts (no `make` on Windows); `scripts/py.mjs` runs the backend venv Python cross-platform.
- **Tables via `create_all` on startup** (no Alembic). Schema changes during development → delete `backend/app.db` and re-seed.
- **Theme / thank_you keys are snake_case** (`text_color`, `button_url`…) to match the rest of the API; DATABASE_SCHEMA.md updated.
- **`response_count` counts completed responses only**; partial responses (bonus) won't inflate it.
- **New questions have an empty title** (builder shows a placeholder). Publishing doesn't yet reject untitled questions.
- **Question `type` is immutable** via PATCH; changing type = delete + add.
- **Option ids** are 8-hex random strings generated server-side for defaults; the client generates ids for options it adds. Empty option labels are allowed so autosave works mid-edit.
- Slugs: 8 random alphanumerics, collision-checked. Duplicate → `"<title> (copy)"`, draft, new slug, no responses.
- **Next `<Activity>`** (cacheComponents) keeps hidden routes mounted: transient UI (menus, dialogs, create modal) resets in a `useLayoutEffect` cleanup.
- Dashboard data lives in `lib/queries/forms.ts` (API fns + query keys + mutation hooks). Server responses are written into both list and detail caches.
- Publishing an empty form is allowed to hit the server, which answers 400 → toast shows its message (clearer than a silently disabled menu item).
- Search/sort are client-side (single creator, small lists).
- SQLite reuses the highest deleted rowid (no AUTOINCREMENT), so a new form can get a just-deleted form's id; caches for deleted forms are removed on delete.
- `lib/api.ts` throws `ApiError { status, message, fieldErrors }`; `status 0` = network failure. Handles both our `{detail:{errors}}` shape and FastAPI's default 422 list.

## Known issues
- `pytest` prints a Starlette deprecation warning (TestClient on `httpx`; suggests `httpx2`). Harmless; revisit if it becomes an error.
- `app/dev/ui` is a temporary primitives showcase — remove in Phase 8. (Health home page replaced by redirect to `/forms`.)
- `/forms/[id]/edit` and `/forms/[id]/results` are "coming soon" stubs until Phases 3 and 6.
- Typeform's real dashboard wasn't compared side by side (needs a login); layout follows DESIGN_SYSTEM.md notes.
