# Handoff: Typeform free-plan parity program (state after Task 7)

Written 2026-10-09 by the session that built Tasks 1–7, so another chat can continue without re-deriving anything.
Read this file, then the docs it points to, then continue with **Task 8** (section 7). Tasks 1–7 are committed as `01f9e61`
and pushed to `origin/main`; this handoff is in the docs commit right after it.

## 1. Paste this into the new chat

> You are continuing a long build in `C:\Users\HP\OneDrive\Desktop\typeform`: a Typeform clone (Next.js 16 + FastAPI +
> SQLite) that must become an exact copy of admin.typeform.com's **free plan** (features, UI and motion), then get
> deployed. First read `docs/superpowers/HANDOFF-parity-program.md` (state, rules, next steps), then
> `docs/superpowers/specs/2026-10-09-typeform-parity-design.md` (program spec, approved) and
> `docs/superpowers/plans/2026-10-09-phase0-1-question-types.md` (the plan being executed). Resume with the
> `superpowers:executing-plans` skill (inline, no subagents unless I ask): the ledger
> `.superpowers/sdd/2026-10-09-phase0-1-question-types/progress.md` says Tasks 1–7 are complete (if that file is missing,
> restore it from `docs/superpowers/ledger-phase0-1-question-types.md`, see section 11); start at **Task 8**
> (`statement`). Use `superpowers:test-driven-development` (watch each test fail first) and
> `superpowers:verification-before-completion`. Standing rules: do NOT commit or push until I say; never print or commit
> API keys (they live only in `backend/.env`); never test against my own servers on ports 3000/8000 or my real
> `backend/app.db` (use the isolated stack on 3100/8100: `npm run e2e:start -- --seed` / `e2e:stop`); Typeform's website
> is read-only for us (open panels and dialogs, never save/create/delete); copy Typeform strictly, animations included;
> the machine is low on RAM and disk, so run one heavy process at a time and no local `next build`.

## 2. How much is done

**Whole program** (spec §5, Phases 0–6): roughly **one eighth** is done (Phase 0 finished, Phase 1 about 45%).

| Phase | What | State |
|---|---|---|
| 0 | stable local stack and test harness | **done** |
| 1 | content model + every free question type + groups, welcome options, endings, change type, results | **in progress, 7 of 16 tasks** |
| 2 | images (Cloudinary), design/themes, Picture Choice | not started |
| 3 | logic and workflow (variables, scoring, recall, URL parameters) | not started |
| 4 | share/embed, results rebuild, form settings + system messages, connect (webhooks/email), templates, workspace parity | not started |
| 5 | Typeform AI everywhere (Gemini Flash-Lite via the backend) | not started |
| 6 | deployment (Railway API + Vercel web), prod DB migration rehearsal | not started |

**Phase 0–1 plan** (`docs/superpowers/plans/2026-10-09-phase0-1-question-types.md`):

| Task | Scope | State |
|---|---|---|
| 1 | isolated test stack (`scripts/e2e-stack.mjs`) | done |
| 2 | ordered idempotent migrations, `endings` table, `group_id`, `forms.welcome` | done |
| 3 | backend question-type registry | done |
| 4 | frontend registry + frontend test runner | done |
| 5 | `website`, `phone_number` | done |
| 6 | `date` | done |
| 7 | `legal`, `checkbox`, `opinion_scale`, `nps` | done |
| 8 | `statement` | **next** (brief read, no code written) |
| 9 | `contact_info`, `address` | to do |
| 10 | `ranking`, `matrix` | to do |
| 11 | question groups | to do |
| 12 | welcome-screen options + multiple endings | to do |
| 13 | change a question's type | to do |
| 14 | settings parity for existing types (Other/None of the above, selection limits, rating shapes…) | to do |
| 15 | Add content catalog + Pages list exactly as Typeform's (paid items disabled with "Soon") | to do |
| 16 | results/CSV/drawer for new types, docs, side-by-side sweep, then the final self-review | to do |

Free question types to add in this phase (13): **done 7** (phone number, website, date, legal, checkbox, opinion scale,
NPS); **left 6** (statement, contact info, address, ranking, matrix, question group). Picture Choice waits for Phase 2.

**Verified now:** backend `npm run test:backend` → 301 passed; frontend `npm run check:frontend` → 53 tests pass, typecheck
and lint clean; browser checks (headless Edge) Task 5 15/15, Task 6 17/17, Task 7 29/29.

**Committed and pushed (the owner asked for it on 2026-10-09 so they could see it deployed).** Tasks 1–7 are commit
`01f9e61` on `origin/main` (parent `3f880e4`); the spec, plan, this handoff, the ledger copy and the browser-check scripts
follow in a docs commit. Vercel (web) and Railway (API) deploy from `main` automatically. Check a deployment with
`gh api repos/ManpreettSingh/typeform/commits/<sha>/status` (contexts "Vercel" and "zoological-upliftment - typeform").
The API runs the migration chain at startup on the production database (rollback notes in section 12). The owner's own dev
servers (3000/8000) still run old code until they restart; their backend restart migrates their real `backend/app.db`
(rehearsed on a copy: rows intact, idempotent), so a backup copy of it first is sensible. Only `.claude/` (a local
preview-server config) was left uncommitted on purpose.

## 3. Goal and the owner's rules

Make the app look and behave like **admin.typeform.com on the free plan**, then deploy. Sequence the owner chose:
(a) all main/free features first (every free question type enabled in Add content instead of "Soon"; paid features shown as
disabled "Soon" items where Typeform shows them) and images via **Cloudinary**; (b) then AI in every place using **Gemini
Flash-Lite (`gemini-3.5-flash-lite`) called from the backend**; (c) then deployment/push. They approved the spec with "go and
start building" and said phases are fine.

Rules (keep following them):
- Copy Typeform strictly, including animations.
- Commit/push **only when the owner says**. They asked for a checkpoint commit + push after Task 7 so they could see it
  deployed; every later commit or push needs their say-so again. Never add `.claude/` to a commit.
- Keys only in `backend/.env` (git-ignored) and Railway variables; never in chat, logs or git. Variable names:
  `GEMINI_API_KEY`, `GEMINI_MODEL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. All were verified
  working; not needed until Phases 2 and 5.
- Typeform's website (a Free-plan account is logged in inside the Claude app's built-in browser) is **read-only**: open
  dialogs/panels, never save, create, send or delete. (A stray draft "New form" `DaXKht1o` already exists there from an
  earlier click; the owner may delete it.) Permission for a scratch form was offered and **not** granted, so each type's
  right-hand panel is copied from Typeform's help articles instead.
- Never run tests against ports 3000/8000 or the real `backend/app.db`; isolated ports 3100/8100 only.
- Kill processes by PID tree only (never by image name). One heavy process at a time; no local `next build`.

## 4. Where everything is

| What | Path |
|---|---|
| Program spec (approved) | `docs/superpowers/specs/2026-10-09-typeform-parity-design.md` |
| Plan being executed (Tasks 1–16) | `docs/superpowers/plans/2026-10-09-phase0-1-question-types.md` |
| Ledger (progress + every ruling; git-ignored) | `.superpowers/sdd/2026-10-09-phase0-1-question-types/progress.md` |
| Ledger snapshot that travels with git (section 11) | `docs/superpowers/ledger-phase0-1-question-types.md` |
| Per-task briefs / test logs (generated) | `.superpowers/sdd/2026-10-09-phase0-1-question-types/task-N-brief.md` |
| Free-plan audit: scope, default texts, themes, gap table | `docs/design/typeform-free-features-audit.md` |
| Measured Typeform layout/colors/motion | `docs/design/typeform-live-reference.md` |
| Older redesign handoff (screens 3–7, motion gallery) | `docs/HANDOFF.md` |
| Browser-check scripts (Playwright, headless Edge) | `docs/superpowers/browser-checks/task{5,6,7}-*.mjs` |
| Skill scripts (`task-start`, `task-done`) | `C:/Users/HP/.claude/plugins/cache/anthropic-plugin-directory/superpowers/6.4.2-8ca22dba9a94/skills/executing-plans/scripts/` |
| Deployments | web `https://typeform-mu-seven.vercel.app`, API `https://typeform-production-3059.up.railway.app/api`, GitHub `ManpreettSingh/typeform` (branch `main`) |

Per task: `task-start <plan> N` prints the brief and BASE; when done, append `Ruling:` lines to the ledger and run
`task-done <plan> N <BASE> -- npm run test:backend` (records the completion line only if tests pass). BASE is the SHA that
`task-start` prints (the current HEAD). The ledger lines for Tasks 1–7 show `3f880e4..3f880e4` because that work was done
before the checkpoint commit `01f9e61`.

## 5. What exists now (architecture to know before touching code)

- **Type registry.** Backend `backend/app/question_types/` (`base.py` defines `QuestionTypeSpec`; `text.py`, `numeric.py`,
  `choice.py`, `dates.py`; `__init__.py` builds `SPECS`). One spec per type: properties model + defaults, `validate`,
  `format` (table/CSV/drawer), `summarize`, `sample` (test responses), `logic_ops` / `logic_match` / `logic_value_error`,
  optional `convert`, `required_message`, `satisfies_required`. Services (`validation`, `stats`, `export`, `logic`,
  `test_responses`, `ai`) read the registry. Frontend mirror: `frontend/lib/questionTypes/index.ts` (+ `dates.ts`,
  `scales.ts`) for logic, plus `frontend/components/questionTypes/{answers,settings}.ts` (React components; `satisfies`
  makes a missing type a compile error). Drift guards: `tests/test_registry.py` (every type has a spec, `EXPECTED_OPS` row per
  type, frontend `QUESTION_TYPES` equals the backend enum).
- **Adding a type = checklist:** enum value (`models/enums.py`) → properties model (`schemas/properties.py`) → summary model
  if new (`schemas/response.py` + TS in `lib/types.ts`) → spec in a `question_types` module → `EXPECTED_OPS` row → frontend
  `QUESTION_TYPES`, property/answer/summary types, def in `lib/questionTypes/index.ts`, answer component, settings component
  (or `null`), Add content item (`type:`), logic editor value editor + `newRule` + `ruleText.ts` (`valueLabel`,
  `isCompleteRule`), results card in `QuestionSummaryCard.tsx`, tests (backend `tests/test_types_*.py`, frontend
  `lib/*.test.ts`), browser check.
- **Migrations.** `backend/app/core/migrations.py` (`MIGRATIONS`, `apply_migrations(engine)`), called by `db.migrate()`.
  Includes the SQLite 12-step rebuild that dropped `ck_questions_type`, the `endings` table (old thank-you → first ending),
  `questions.group_id`, `forms.welcome`. Tests: `tests/test_migrations.py` + `tests/fixtures/schema_v1.sql`.
- **Frontend tests.** `npm run test:frontend` (Node built-in runner + `tsx`), `npm run check:frontend` = tests + typecheck +
  lint. Fixtures in `frontend/lib/__fixtures__/questions.ts`.
- **Required-answer rules are per type** (Task 7): `required_message` / `satisfies_required` on the spec (server,
  `services/validation.py`) and `requiredMessage` / `satisfiesRequired` on the def (client, `lib/validation.ts`).
- **Errors/defaults use Typeform's default texts** (audit §4), mirrored server and client.
- **Answer storage.** `answers.value` is JSON: strings, numbers, booleans, lists; composite types will store objects.
  Dates are `YYYY-MM-DD`; phones E.164; legal/checkbox booleans.

## 6. Rulings already made (full text with costs is in the ledger)

Work in place on `main`, no worktree (the owner reviews live on :3000); no commits; final review is a self-review
(no subagents unless the owner asks). Enum values are added per type task (not all at once). `apply_migrations` lives in
`core/migrations.py`. Properties models stay in `schemas/properties.py`; specs reference them. `rule_matches` takes
optional `props`. Added `tsx` + frontend tests. Component half of the registry split into `answers.ts`/`settings.ts`
(public form never bundles builder code); summaries stay in `QuestionSummaryCard`'s switch until the Phase 4 results rebuild.
`toSubmission(question, value)`. Phone input lazy-loaded. `dates.py` (not `date.py`). `opLabels` / `opLabel()` for date
wording. Task 7: legal required message "Please agree to the terms & conditions", checkbox required message "Oops! Please
make a selection", opinion scale/NPS keep "Please fill this in"; checkbox answers are `true` or absent (summary lists one
"Checked" count; a rule can only test "is checked"); sample answers for legal/checkbox are always true; opinion scale range =
`steps` boxes from 1 (or 0); NPS score rounded half up; number keys choose a step, "1" then "0" = 10; checkbox label is edited
on the canvas (no CheckboxSettings panel); Opinion Scale added to Add content.

**Gap noted, not built:** Typeform lets creators format question text (bold, italic, hyperlinks) and its Checkbox article
relies on links for terms; neither spec nor plan has rich text, so a Legal notice or checkbox label shows a URL as plain
text. Suggest a rich-text slice in Phase 4.

## 7. Next: Task 8 (`statement`) and what it touches

Brief: `.superpowers/sdd/2026-10-09-phase0-1-question-types/task-8-brief.md` (run `task-start` again if it is missing).
Statement = `{button_text: "Continue"}`, `answerable=False`: never in answers, results, CSV or summary; respondent sees title,
description and a Continue button (Enter works); in logic it is never a condition source but can be a jump target. Tests named in
the plan: `test_statement_never_stored`, `test_statement_not_in_summary_or_csv`, `test_statement_can_be_jump_target`.

Analysis done so far (nothing written yet). The registry already treats `answerable=False` as "no answer", but several callers
still iterate every question and must skip statements:
- `services/validation.py`: `known` ids must exclude non-answerable questions (so a submission naming a statement id gets
  "Unknown question"), and the path loop must skip them (never required).
- `services/stats.py` (`questions=[…]` in `summarize_form`), `services/export.py` (CSV columns), `services/test_responses.py`
  (`sample` is `None` for statements) must filter on `spec.answerable`.
- `schemas/logic.py::rule_errors` indexes `OPS_BY_TYPE[qtype]`, which only has answerable types → a rule on a statement would
  raise `KeyError`; return a clean 422 instead. A statement's `required` must be forced to `False`.
- Frontend: `StatementScreen.tsx` (title, description, Continue button, Enter), the flow must not wait for an answer
  (`isEmptyAnswer`, `answered` count in the progress bar, `visitedPath` is fine), hide the Required switch and the Logic card
  in the builder for statements, chip color = screens (gray `bg-qt-screen`), Add content item "Statement" (Task 15 reorganizes
  that modal into a "Form structure" group), results/summary/table/drawer must skip it, `components/questionTypes/*` entries.
- Read Typeform's Statement help article first (search "statement" in `help.typeform.com/hc/en-us/search?query=…`; open it with
  the built-in browser because `WebFetch` gets 403) to see which panel settings it has (button text; possibly a quotation-mark
  switch) and copy them.

After Task 8: Tasks 9–16 as in the table (details in the plan; read the brief with `task-start`). Review Focus items 2, 3, 4,
5 in the plan are still open (stale ids after edits, group edge cases, composite answers with empty sub-fields). When Task 16
is done: run the final self-review (read `code-reviewer.md` from the `requesting-code-review` skill; write
`Final review: self-review (no subagent tool)` to the ledger), fix Critical/Important findings with a failing test first,
and in the final message list "Rulings I made" (every `Ruling:` line) and "Deferred minors". Then ask the owner about the
phase commit, and move to Phase 2 (write its own short plan first; the spec describes it).

## 8. How to run and verify

```bash
npm run test:backend          # pytest on a temp DB (301 passed at the end of Task 7)
npm run check:frontend        # node tests + tsc + eslint (53 tests)
npm run e2e:start -- --seed   # isolated stack: web :3100, api :8100, DB in %TEMP%\typeform-e2e\e2e.db
npm run e2e:status
npm run e2e:stop              # always stop it before ending a turn
```

- uvicorn on 8100 runs **without** `--reload`: restart the stack to load backend changes. The Next dev server on 3100 once
  died by itself (low RAM) → `e2e:stop` then `e2e:start`. A fresh start takes ~1 minute.
- Browser checks: Playwright with `channel: "msedge"`, `headless: true` (the built-in browser pane is hidden in this app, so
  `requestAnimationFrame` never fires there and framer-motion/screenshots stall; use it only for reading pages). The scripts in
  `docs/superpowers/browser-checks/` create their own forms through the API on 8100, drive the live form and the builder,
  fail if any request goes to `localhost:3000/8000`, and write screenshots to `./shots/`. They import `playwright-core`; the
  previous scratch folder that has it installed is
  `C:\Users\HP\AppData\Local\Temp\claude\C--Users-HP-OneDrive-Desktop-typeform\335d3792-d367-41ef-b627-527011a3ccc4\scratchpad`
  (otherwise `npm i playwright-core` in a new scratch folder and copy a script there). Wait for message **text**
  (`getByRole("alert").filter({hasText: …})`), not for a bare `[role=alert]`.
- Machine: ~1–2 GB free RAM and ~4 GB free on C:. After browser runs, delete leftover `%TEMP%\playwright_chromiumdev_profile-*`
  folders if disk is tight.

## 9. Tooling quirks seen in this setup

- Bash `cd` persists between calls and changes the working directory: start commands with `cd "C:/Users/HP/OneDrive/Desktop/typeform"`.
- Do not wrap commands in `bash -c '…'` (blocked by a safety check) and avoid giant heredocs with quotes; for multi-line edits use
  the Write tool to create a small Python script in the scratchpad and run it, or use the Edit tool.
- `WebFetch` gets 403 on `help.typeform.com`; read help articles through the built-in browser (`navigate` + `get_page_text` or
  `javascript_tool` on `main`). Article links in search results are click-tracking URLs; decode them or open the article by id.
- Windows line endings: git warns LF→CRLF on some files; harmless.

## 10. Open points for the owner

1. **Checkpoint done:** committed and pushed at the owner's request; remind them that further commits wait for their say-so.
2. **Restart their dev servers** (`npm run dev`, frontend and backend) to see the new types on localhost:3000; the backend
   restart runs the migrations on their real DB (back up `backend/app.db` first).
3. Rich-text formatting/hyperlinks gap (section 6).
4. The "Create with AI" tab and AI entry points stay "Soon" until Phase 5.

## 11. What a new AI needs to continue

**Same machine, same folder (easiest):** only the prompt in section 1. Everything else is already there: the repo (with this
handoff, the spec and the plan), `backend/.env` with the keys (local only, never in git), the git-ignored ledger under
`.superpowers/`, `node_modules`, `backend/.venv`, and the Claude project memory (loaded automatically).

**Different machine or a cloud session:** give it
1. the repo: `git clone https://github.com/ManpreettSingh/typeform.git` (the docs, plan, handoff and ledger snapshot are in it);
2. the keys, typed by the owner into `backend/.env` (copy `backend/.env.example`; names `GEMINI_API_KEY`, `GEMINI_MODEL`,
   `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`). Never paste keys into a chat. They are not needed
   until Phases 2 and 5;
3. setup: `npm install` in the repo root and in `frontend/`, a Python venv in `backend/` with
   `pip install -r backend/requirements.txt`, Microsoft Edge plus `npm i playwright-core` in a scratch folder for browser checks;
4. the ledger: run the executing-plans skill's `sdd-workspace docs/superpowers/plans/2026-10-09-phase0-1-question-types.md`, then
   copy `docs/superpowers/ledger-phase0-1-question-types.md` (minus the first HTML comment line) to `<workspace>/progress.md`;
   without it the skill believes no task is done and starts over;
5. the prompt in section 1;
6. optionally a browser the AI controls that is logged into the owner's Free Typeform account, for read-only side-by-side
   checks (the owner logs in themselves; the AI never types credentials).

The Claude memory notes are machine-local; their useful content is repeated in sections 3, 8 and 9 above.

## 12. Deployment notes and rollback

- Pushing to `main` deploys both services (GitHub integrations): Vercel builds `frontend`, Railway installs
  `backend/requirements.txt` (new: `phonenumbers`) and starts the API, which runs `migrate()` on the production database.
  No new environment variables are needed for this checkpoint (the Gemini and Cloudinary variables belong to Phases 2, 5, 6).
- Migration on production: drops the `questions.type` CHECK by rebuilding the table (one transaction, foreign-key check,
  rollback on error), adds `questions.group_id` and `forms.welcome`, and creates one ending per form from its old thank-you.
  A failure stops the API from starting and leaves the data as it was. It was rehearsed on a copy of the owner's local
  database, not on the production one.
- Rollback: redeploy `3f880e4` (dashboards, or `git revert`). The old code runs on a migrated database (new columns are
  nullable or defaulted, the `endings` table is ignored). Once someone has created a question of a new type in production,
  the old code can no longer read that question.
- A failed Vercel build leaves the previous deployment serving. For Railway check the dashboard after the push.
- Read-only checks that don't touch production data: the API's `/openapi.json` lists the new question types once the new
  backend is live; the GitHub commit status shows both deployments.
