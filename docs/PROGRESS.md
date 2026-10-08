# PROGRESS

**Current phase:** Phase 6 — Results & Analytics
**Last updated:** 2026-10-08
**Next action:** Run `phases/PHASE_6.md`

## Phase status
| # | Phase | Status |
|---|---|---|
| 0 | Foundation & scaffolding | ✅ Done |
| 1 | Database & Core Backend API | ✅ Done |
| 2 | Dashboard / Form Management | ✅ Done |
| 3 | Builder I — Structure & Question Editing | ✅ Done |
| 4 | Builder II — Drag-drop, Live Preview, Settings | ✅ Done |
| 5 | Respondent Flow (public) | ✅ Done |
| 6 | Results & Analytics | ⬜ |
| 7 | Polish, Bonuses & Placeholders | ⬜ |
| 8 | Seed, README, QA & Submission | ⬜ |

## Feature checklist
### Form Management
- [x] List forms (status, response count)
- [x] Create / rename / duplicate / delete
- [x] Publish / unpublish + share link + copy
### Builder
- [x] Title inline edit
- [x] Add question (8 types)
- [x] Edit title / description / required
- [x] Options editor (choice, dropdown) / rating max
- [x] Delete question
- [x] Drag-and-drop reorder (persisted)
- [x] Live preview
- [x] Autosave + "Saved" indicator
- [x] Settings placeholders (theme, thank-you screen)
### Respondent
- [x] Public page by slug (published only)
- [x] One-at-a-time full-screen + transitions
- [x] Keyboard nav (Enter / arrows / letter shortcuts)
- [x] Progress indicator
- [x] Client validation
- [x] Server validation
- [x] Submit + thank-you
### Results
- [ ] Responses table
- [ ] Single response view
- [ ] Summary stats per question
### Experience
- [ ] Toasts, modals, empty/loading/error states (dashboard, builder, public form ✅; results pending)
- [ ] "Coming soon" placeholders (Logic/Integrations/Collaborate ✅; Payment/File upload types pending)
### Bonus
- [ ] Branching / logic jumps
- [x] Custom themes (colors + font; applied to builder preview and public page)
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
| 2026-10-08 | 3 | Builder at `/forms/[id]/edit`: Zustand `store/builderStore.ts` + `store/autosave.ts` (per-key debounced, ordered saves; rollback to last server copy + toast on failure); top bar (back, inline title, Draft/Published badge, Create/Results/Share tabs, save indicator, Publish/Unpublish → Share modal); left list (numbers, type chips, required marker, hover delete, "Add question" type picker inserting after the selected question); right settings (title, description, required, choices editor w/ Enter-to-add/Backspace-to-remove, allow multiple, rating steps+shape, number min/max, text placeholder/max length); static centre preview; empty/loading/not-found/error states; delete confirm only when the form has responses. New primitives: Textarea, Select, Button `dangerGhost` | 33-check browser run (isolated ports + throwaway DB) incl. persistence after refresh and forced-500 rollback; dashboard suite re-run 29/29. Preview number alignment fix not re-screenshotted |
| 2026-10-08 | 4 | dnd-kit sortable question list (handle, keyboard, overlay, SR announcements) → optimistic reorder + `PUT …/order`, rollback to server order on failure; shared respondent components in `components/respondent/` (QuestionShell, one answer component per type, QuestionRenderer `mode=preview|live`, ThankYouScreen, RespondentTheme, RespondentFlow with transitions, progress bar, Enter/↑↓/letter/Y-N/number shortcuts, auto-advance, client validation via `lib/validation.ts`); builder canvas uses them live; full-screen Preview overlay (local, Restart); Settings tab: Theme (3 colors + font, saved) and Thank-you screen (saved), Logic/Integrations/Collaborate "Coming soon". Store: `updateForm` for title/theme/thank_you | 33-check Phase 4 browser run + Phase 3 (33) and Phase 2 (29) suites re-run green on isolated ports. Optional "+ insert between" not done |
| 2026-10-08 | 5 | Backend: `GET /public/forms/{slug}` (published only, no internal fields), `POST …/responses` (validates all answers, 422 keyed by question id incl. unknown ids, one transaction, status completed); `services/validation.py` mirrors `lib/validation.ts` (same messages); `services/submissions.py`; 41 new pytest tests (73 total). Frontend: `/f/[slug]` with loading / not-available / load-error+retry states, form title as page title, theme on full viewport (`h-dvh`); flow rebuilt on a reducer (`flowState.ts`): optional welcome screen, shake on rejected Enter, `n of N`, Esc leaves a text field, focus moves to each new question, last question never auto-submits and ↓ is disabled there, double-submit guard, server 422 jumps to the first offending question, network/5xx → persistent toast with Retry; `toSubmission()` drops empty answers, trims text | 43-check Phase 5 browser run (isolated ports, throwaway DB: keyboard-only fill of all 8 types, persisted values checked in SQLite, API bypass → 422, mocked 422 + network failure, reduced motion, 390px). Phase 4 / 3 (33) / 2 (29) suites re-run green. Dashboard/builder suites need a fresh DB per run |

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
- **Builder data flow**: the builder always reloads the form from the server when shown (after flushing pending saves) instead of reading the Query cache; the Zustand store is the single source of truth while editing. The dashboard list uses `staleTime: 0` so it refreshes after builder edits.
- **Autosave**: text edits debounce 600 ms, toggles/selects/structural changes save immediately; edits to the same question merge and are sent in order. Invalid local input (min > max, bad max length) is shown inline and not sent.
- **New questions are inserted after the selected one** (Typeform behaviour); new choices likewise go right below the current choice.
- **Choices: minimum 1** (matches the server); remove is disabled on the last one.
- **Welcome screen is shown only when the form has a description** (DATABASE_SCHEMA: description = welcome subtitle). The builder has no description field yet, so today only seeded/API-made forms get one; the builder preview never shows it.
- **Public submissions**: empty optional answers are omitted (not stored); text/email are trimmed; text without `max_length` is capped at 10,000 chars; types are strict (number must be a JSON number, rating an integer, multi-select a list, single-select a string). Messages match the client's so server errors read like client ones.
- **Last question never auto-submits** (choice/yes-no/rating auto-advance is off there) and the ↓ arrow is disabled on it — submitting always takes OK/Enter.
- **Submit errors**: 422 with known question ids → jump back to the first one with the message; 404 (unpublished meanwhile) or 422 for questions the page doesn't know (form edited meanwhile) → toast asking to reload; network/5xx → toast with Retry (answers kept).
- **Public form is fetched once per visit** (no refetch on focus/reconnect) so questions can't change mid-fill.
- **Respondent components are shared** by the builder canvas (`mode="preview"`: no autofocus/shortcuts/auto-advance), the full-screen preview and (Phase 5) the public page (`mode="live"`). Themes apply via `--resp-*` CSS variables set by `RespondentTheme`; button text color is picked for contrast.
- **Theme fonts**: Inter (downloaded) plus system stacks (System UI, Georgia, Courier) — no extra font downloads.
- **Auto-advance** after picking a single choice / yes-no / rating (400 ms), like Typeform. Multi-select waits for OK/Enter.
- **Reorder saves the full current order** when the request runs, so queued adds/deletes/moves stay consistent; on failure the server order is reloaded.
- **Next `<Activity>`** (cacheComponents) keeps hidden routes mounted: transient UI (menus, dialogs, create modal) resets in a `useLayoutEffect` cleanup.
- Dashboard data lives in `lib/queries/forms.ts` (API fns + query keys + mutation hooks). Server responses are written into both list and detail caches.
- Publishing an empty form is allowed to hit the server, which answers 400 → toast shows its message (clearer than a silently disabled menu item).
- Search/sort are client-side (single creator, small lists).
- SQLite reuses the highest deleted rowid (no AUTOINCREMENT), so a new form can get a just-deleted form's id; caches for deleted forms are removed on delete.
- `lib/api.ts` throws `ApiError { status, message, fieldErrors }`; `status 0` = network failure. Handles both our `{detail:{errors}}` shape and FastAPI's default 422 list.

## Known issues
- `pytest` prints a Starlette deprecation warning (TestClient on `httpx`; suggests `httpx2`). Harmless; revisit if it becomes an error.
- `app/dev/ui` is a temporary primitives showcase — remove in Phase 8. (Health home page replaced by redirect to `/forms`.)
- `/forms/[id]/results` is a "coming soon" stub until Phase 6.
- "Already submitted" detection (optional in Phase 5) not done: the same browser can submit again.
- No way to set the form description (welcome screen) from the builder yet.
- Turbopack production rebuilds report "Compiled" in ~1s from cache; changes did land (checked in the built chunks), but if a build looks stale, clear `frontend/.next/cache/turbopack`.
- Builder is desktop-first: below `lg` the centre preview is hidden; below `md` list and settings stack.
- Untitled questions can still be published (server only rejects zero questions).
- **Turbopack cache can serve a stale `globals.css`** (seen 2026-10-08, project lives in OneDrive): new theme tokens didn't reach the CSS until `.next/cache/turbopack` was cleared. If new Tailwind tokens/classes don't apply, stop `npm run dev`, delete `frontend/.next/dev/cache` (dev) or `frontend/.next/cache/turbopack` (build), and restart.
- Optional "+ insert between questions" control (Phase 4 task 6) not implemented; new questions insert after the selected one instead.
- Typeform's real dashboard wasn't compared side by side (needs a login); layout follows DESIGN_SYSTEM.md notes.
