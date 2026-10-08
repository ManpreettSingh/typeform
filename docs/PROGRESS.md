# PROGRESS

**Current phase:** All phases done (0–8)
**Last updated:** 2026-10-08
**Next action:** Submit. Optional: deploy (Phase 8 task 8, not done)

## Phase status
| # | Phase | Status |
|---|---|---|
| 0 | Foundation & scaffolding | ✅ Done |
| 1 | Database & Core Backend API | ✅ Done |
| 2 | Dashboard / Form Management | ✅ Done |
| 3 | Builder I — Structure & Question Editing | ✅ Done |
| 4 | Builder II — Drag-drop, Live Preview, Settings | ✅ Done |
| 5 | Respondent Flow (public) | ✅ Done |
| 6 | Results & Analytics | ✅ Done |
| 7 | Polish, Bonuses & Placeholders | ✅ Done |
| 8 | Seed, README, QA & Submission | ✅ Done |

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
- [x] Responses table
- [x] Single response view
- [x] Summary stats per question
### Experience
- [x] Toasts, modals, empty/loading/error states, 404 page, error boundaries, favicon, per-form builder tab title
- [x] "Coming soon" placeholders (Integrations, Collaborate; Payment / File upload question types)
### Bonus
- [x] Branching / logic jumps (forward-only, builder Logic panel + overview, path-aware flow and validation)
- [x] Custom themes (colors + font; applied to builder preview and public page)
- [x] CSV export
- [x] Partial responses / completion rate (`/responses/start` + PATCH per step, token-protected)
- [x] Dark mode (creator UI; Light / Dark / System)
### Submission
- [x] Seed data: Customer Feedback (30 responses, 4 partial) + Event Registration (22, 3 partial), both published with logic jumps; 1 draft
- [x] README (screenshots, setup, stack, architecture, ER diagram, API summary, assumptions, bonuses, limitations)

## Session log
| Date | Phase | What was done | Issues / follow-ups |
|---|---|---|---|
| 2026-10-08 | 0 | FastAPI skeleton (app factory, CORS, `/api/health`, SQLite session w/ FK pragma, 3 pytest tests); Next.js 16 + Tailwind v4 app with design tokens, Inter, `lib/api.ts`, Query + Toaster providers, 9 UI primitives, `/` health page, `/dev/ui` showcase; root npm scripts, README stub, `.gitignore`, `.env.example`s | Health badge on `/` not checked in a real browser (CORS + endpoints verified via curl) |
| 2026-10-08 | 1 | Models (Form/Question/Response/Answer: CHECKs, cascades, indexes, UTC timestamps); per-type `properties` schemas + defaults; forms CRUD, duplicate, publish/unpublish; questions create/patch/delete; transactional reorder; `{detail}` error format incl. 422 `{detail:{errors}}`; `seed.py` (1 demo form, idempotent); 32 pytest tests on a temp DB; `lib/types.ts` | No frontend consumes the API yet (Phase 2) |
| 2026-10-08 | 2 | `/` → `/forms` dashboard: top nav + Create form modal (→ builder route); card grid (thumbnail, status, responses, relative updated time, copy link, Results link, ⋯ menu: open/results/share/copy link/rename/duplicate/publish-unpublish/delete); search + sort; Share modal (auto-opens after publish); optimistic rename/delete with rollback; toasts on every action; skeleton/empty/no-match/error+retry states. New primitives: Skeleton, EmptyState, Input `leftIcon`; Menu closes on route hide + restores focus. Stub pages for `/forms/[id]/edit` and `/results` | Verified with a 29-check headless Edge run (Playwright, throwaway DB) incl. persistence after refresh, clipboard, 390px layout. `/f/{slug}` link 404s until Phase 5 |
| 2026-10-08 | 3 | Builder at `/forms/[id]/edit`: Zustand `store/builderStore.ts` + `store/autosave.ts` (per-key debounced, ordered saves; rollback to last server copy + toast on failure); top bar (back, inline title, Draft/Published badge, Create/Results/Share tabs, save indicator, Publish/Unpublish → Share modal); left list (numbers, type chips, required marker, hover delete, "Add question" type picker inserting after the selected question); right settings (title, description, required, choices editor w/ Enter-to-add/Backspace-to-remove, allow multiple, rating steps+shape, number min/max, text placeholder/max length); static centre preview; empty/loading/not-found/error states; delete confirm only when the form has responses. New primitives: Textarea, Select, Button `dangerGhost` | 33-check browser run (isolated ports + throwaway DB) incl. persistence after refresh and forced-500 rollback; dashboard suite re-run 29/29. Preview number alignment fix not re-screenshotted |
| 2026-10-08 | 4 | dnd-kit sortable question list (handle, keyboard, overlay, SR announcements) → optimistic reorder + `PUT …/order`, rollback to server order on failure; shared respondent components in `components/respondent/` (QuestionShell, one answer component per type, QuestionRenderer `mode=preview|live`, ThankYouScreen, RespondentTheme, RespondentFlow with transitions, progress bar, Enter/↑↓/letter/Y-N/number shortcuts, auto-advance, client validation via `lib/validation.ts`); builder canvas uses them live; full-screen Preview overlay (local, Restart); Settings tab: Theme (3 colors + font, saved) and Thank-you screen (saved), Logic/Integrations/Collaborate "Coming soon". Store: `updateForm` for title/theme/thank_you | 33-check Phase 4 browser run + Phase 3 (33) and Phase 2 (29) suites re-run green on isolated ports. Optional "+ insert between" not done |
| 2026-10-08 | 5 | Backend: `GET /public/forms/{slug}` (published only, no internal fields), `POST …/responses` (validates all answers, 422 keyed by question id incl. unknown ids, one transaction, status completed); `services/validation.py` mirrors `lib/validation.ts` (same messages); `services/submissions.py`; 41 new pytest tests (73 total). Frontend: `/f/[slug]` with loading / not-available / load-error+retry states, form title as page title, theme on full viewport (`h-dvh`); flow rebuilt on a reducer (`flowState.ts`): optional welcome screen, shake on rejected Enter, `n of N`, Esc leaves a text field, focus moves to each new question, last question never auto-submits and ↓ is disabled there, double-submit guard, server 422 jumps to the first offending question, network/5xx → persistent toast with Retry; `toSubmission()` drops empty answers, trims text | 43-check Phase 5 browser run (isolated ports, throwaway DB: keyboard-only fill of all 8 types, persisted values checked in SQLite, API bypass → 422, mocked 422 + network failure, reduced motion, 390px). Phase 4 / 3 (33) / 2 (29) suites re-run green. Dashboard/builder suites need a fresh DB per run |
| 2026-10-08 | 6 | Backend: `GET /forms/{id}/responses` (paginated, status filter, newest first), `GET …/responses/{rid}` (answers with question titles, in order), `DELETE …/responses/{rid}`, `GET /forms/{id}/summary` via `services/stats.py` (choice/dropdown/yes-no counts, rating average + distribution, number min/avg/max, latest 5 text answers), bonus `GET …/responses/export.csv` (`services/export.py`, readable values, BOM, formula-injection guard); seed adds 10 demo responses (8 completed, 2 partial) only to a seeded form that has none; 14 new pytest tests (87 total) incl. summary checked against the raw seed data. Frontend `/forms/[id]/results`: header (Create / Results / Share, View form), Summary | Responses tabs, stat tiles (responses, completion rate, in progress), per-question cards with single-hue horizontal bars (counts + %), rating average, number figures, recent text; responses table (one column per question, truncated, sticky date, keyboard-openable rows, pagination, Export CSV); `Drawer` primitive with full response (formatted per type, newer/older, delete with confirm); empty state with Share / Publish & share; `lib/answerFormat.ts` mirrors the CSV formatting | 38-check Phase 6 browser run (isolated ports, fresh seeded DB): tiles/averages/counts compared with SQL over the DB, new public submission appears, drawer formatting for all 8 types, delete, CSV download, pagination (25), empty/draft states, builder ↔ results tabs, 390px. Phase 5 (43), 4 (33), 3 (33), 2 (29, seeded-card check updated for the new demo responses) re-run green |

| 2026-10-08 | 7 | **Branching**: `schemas/logic.py` (ops/values per type, ≤20 rules, 422 keyed `logic.rules.<i>.*`), `services/logic.py` resolver (forward-only → no cycles) mirrored by `lib/logic.ts`; PATCH `/questions` accepts `logic` (targets must be other questions of the form); delete drops jumps to the deleted question; duplicate remaps targets; submissions validated along the respondent's path. Builder: Logic section per question (condition / value / target, half-typed rules kept local until valid, warnings for removed choices and backward jumps), branch icon in the list, Settings → Logic overview with Edit links. Flow: history stack for ↑, path-based progress and "n of N", Submit / auto-advance aware of jumps to the end. **Partial responses**: `POST …/responses/start` → `{response_id, token}`, `PATCH /public/responses/{id}` (snapshot replace, `complete`), 409 once completed; client `usePartialResponse` (start on first move, serialized silent saves, POST fallback). **Dark mode**: dark token set under `:root[data-theme=dark]`, inline head script (no flash), `ThemeToggle` (Light / Dark / System, follows the OS and other tabs) in dashboard / builder / results headers, sonner follows it; respondent content uses fixed `--ink` / `--paper` / `--resp-error*` so forms look the same in both. **Polish**: `not-found.tsx`, `error.tsx`, `global-error.tsx`, `icon.svg` (replaces the stock Next favicon), builder `<title>` with the form name, phone builder shows one pane at a time (Questions / Edit question / Settings), responsive skeleton, compact phone top bar. Payment / File upload types listed disabled in Add question. 13 new pytest tests (100 total) | 56-check Phase 7 browser run (isolated ports, fresh seeded DB): rule add / edit / remove persisted, incomplete rule not sent, backward-jump warning, overview + Edit, preview follows jumps, three respondent paths checked in SQLite (early end, skip, dropped off-path answer), partial row created / updated / completed in place, abandoned partial in results, wrong token 404, dark toggle + reload with JS blocked + System follows OS, forms unaffected by dark mode, 404 page, favicon, disabled types, 390px builder. Phase 2 (29), 3 (33), 4 (33, Logic check updated), 5 (43, final-submit counter includes the PATCH) and 6 (38) re-run green |

| 2026-10-08 | 8 | **Seed** rewritten: "Customer Feedback" (7 types, 1–10 rating, Yes/No jump), "Event Registration — Frontend Summit" (custom dark theme + Georgia, number, Day-pass jump, thank-you button), "Product Survey (draft)"; responses generated from fixed random seeds, spread over 30 days, each run through `validate_answers` (so branching holds) and partial ones cut part-way along their path; still keyed by slug + only fills forms without responses. Seed-based pytest tests now derive expectations from the DB rows instead of hard-coded values (101 tests). **README** rewritten (8 screenshots in `docs/screenshots/`, Mermaid ER diagram, API table, assumptions, limitations). **Cleanup**: `/dev/ui` removed, unused `DEFAULT_THANK_YOU` removed, `setup.mjs` no longer triggers Node's DEP0190 warning, no stray console logs. **Typeform comparison** (public typeform.com form; builder/dashboard need a login): respondent fixes: no focus ring on the auto-focused Start button, 1px answer underline that thickens on focus, 8px button / ↑↓ radius (`--radius-resp-button`), required `*` in the title color, 26/34px question titles; also dropped a doubled "?." in the logic hint | Fresh-clone check: copy of tracked + untracked files → `npm install`, `npm run setup`, `npm run seed` in **73 s**, then build + start on isolated ports, app immediately usable with data (README screenshots taken from it). All browser suites re-run green on the new seed: Phase 2 (29), 3 (33), 4 (33), 5 (43), 6 (38), 7 (56) — fixtures updated for the new demo forms. Normal build / typecheck / lint / pytest green. Deploy not done |

## Decisions & assumptions (feeds README)
- **Branching is forward-only.** A rule may name any other question (so a reorder never makes autosave fail), but at fill time a target that isn't after the question is skipped; the builder flags such rules. First matching rule wins; unanswered questions match nothing; no match → next question.
- **Rule values aren't checked against current options.** A rule naming a since-removed choice never matches (the builder shows "Removed choice" with a warning).
- **Questions a jump skips** aren't required, and answers to them are dropped by client and server (e.g. answered, then went back and took another branch).
- **Auto-advance is off on any question whose answer can end the form** (last question, or a rule to "end"), so a pick never submits by surprise; OK reads "Submit" when the current answer ends the form.
- **Partial responses** start on the first move past question 1 (page views alone don't create rows) and store a snapshot of the on-path answers on every move. Saving progress is silent and best-effort; the final submit completes the same row (`started_at` kept) or falls back to the plain POST. A random per-response token in `responses.meta` stops others from writing to it; completed responses can't be changed (409).
- **Dark mode covers the creator UI only.** Public forms and the builder canvas always use the form's theme; the preference lives in `localStorage` (`color-scheme`), default System.
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
- **Results stats cover completed responses only** (like `response_count`); totals/completion rate count partial ones too. Choice answers naming options removed since aren't counted in the summary; the table/drawer/CSV show them as “(removed choice)”.
- **Answer formatting lives in two mirrored places**: `lib/answerFormat.ts` (UI) and `services/export.py` (CSV). Multi-select joins with “, ” in the UI and “; ” in CSV (commas are common in labels).
- **The response drawer uses the row already loaded in the table** (no extra request); `GET …/responses/{rid}` exists for API completeness and is covered by tests.
- **Results data refetches on window focus** (staleTime 0) so new submissions show when the creator comes back to the tab; there's no live push.
- **CSV export is a plain link to the API** (no fetch), so the browser handles the download with the server's filename.
- **Seeded responses are only added to a seeded form with zero responses**, so re-running `npm run seed` never mixes demo rows into real data.
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
- Below `md` the results header hides the Create / Results / Share tabs; the builder's phone pane bar reaches Settings, but Results / Share aren't reachable from the phone builder header.
- Logic rules can't be reordered (remove and re-add to change their order).
- Abandoned partial responses are kept (no cleanup); a respondent who reloads mid-form starts a new partial response.
- `app/global-error.tsx` wasn't exercised in the browser (needs the root layout itself to throw).
- The drawer's newer/older buttons only move within the current table page.
- No status filter in the responses table UI (the API supports `?status=`).
- "Already submitted" detection (optional in Phase 5) not done: the same browser can submit again.
- No way to set the form description (welcome screen) from the builder yet.
- Turbopack production rebuilds report "Compiled" in ~1s from cache; changes did land (checked in the built chunks), but if a build looks stale, clear `frontend/.next/cache/turbopack`.
- Builder is desktop-first: below `lg` the centre preview is hidden; below `md` one pane at a time (Questions / Edit question / Settings).
- Untitled questions can still be published (server only rejects zero questions).
- **Turbopack cache can serve a stale `globals.css`** (seen 2026-10-08, project lives in OneDrive): new theme tokens didn't reach the CSS until `.next/cache/turbopack` was cleared. If new Tailwind tokens/classes don't apply, stop `npm run dev`, delete `frontend/.next/dev/cache` (dev) or `frontend/.next/cache/turbopack` (build), and restart.
- Optional "+ insert between questions" control (Phase 4 task 6) not implemented; new questions insert after the selected one instead.
- Typeform's real dashboard and builder weren't compared side by side (need a login); only a public Typeform form was. Dashboard / builder follow DESIGN_SYSTEM.md notes.
- Not deployed (optional Phase 8 task).
