# Handoff for the next chat (written 2026-10-09, evening)

Read this first.

## 1. The project and the goal
A **Typeform clone** for the owner's 24-hour assignment: it must look and behave like **admin.typeform.com on the free plan**
(features, UI, motion), plus one thing Typeform doesn't have in this form: a **first-visit onboarding** stored in localStorage
(no accounts, no sign-up). Stack: Next.js 16 (`frontend/`, App Router; read `frontend/AGENTS.md`, this Next has breaking changes),
FastAPI + SQLite (`backend/`). Deployed: web https://forms.preet.cloud, API
https://typeform-production-3059.up.railway.app/api, repo `ManpreettSingh/typeform`, branch `main` auto-deploys both.

## 2. The owner's rules (they have said these, follow them)
- **One feature at a time, no parallel subagents** (a six-agent run was stopped as "too cluttered"). Don't use subagents unless asked.
- **Commit and push only when asked.** Branch first when on `main` (commits so far: AI chat `00485cb` was merged and pushed on request).
  Never add `.claude/` to a commit. Commit messages end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- **Copy Typeform strictly**, animations included. Typeform's website (a Free account is logged in inside the Claude app's built-in
  browser) is **read-only**; the one exception the owner allowed is the scratch draft form `DaXKht1o` (3 questions, 2 endings, nothing
  published). Never send prompts to Typeform's AI or save/delete anything there without asking.
- **Keys only in `backend/.env` (git-ignored) and Railway variables.** Never print them or put them in chat or git.
- Speed matters (24 h). Keep answers short and honest: say what is verified and what isn't.

## 3. How to run and check things (Windows, low-RAM machine)
- Tests: `node scripts/py.mjs -m pytest -q` (backend, **run from the repo root; the wrapper cd's into backend**, test paths are relative to
  `backend/`, e.g. `tests/test_ai_chat.py`); `cd frontend && npm test` (node:test + tsx); `npm run typecheck`; `npx eslint <paths>`.
  Last known: **407 backend tests, 110 frontend tests passing**, typecheck clean, lint clean except an old `<img>` warning.
- Heavy commands one at a time. A lock wrapper exists at
  `C:/Users/HP/AppData/Local/Temp/claude/C--Users-HP-OneDrive-Desktop-typeform/2b4f7faf-ed78-43b0-8d9d-dc4dbfaf669f/scratchpad/with-lock.mjs`
  (`node with-lock.mjs <command>`); recreate it if the folder is gone. Free RAM is often 0.5 to 3 GB (Chrome holds ~4 GB) and C: has about 1 GB
  free: close the built-in browser tab when memory is tight; never run `next build`.
- Dev stack: `preview_start` with name `dev` (runs `npm run dev`: web :3000, API :8000, **the owner's real `backend/app.db`**). It died once
  after a `git switch`; stop and start it again. **Never run automated tests against 3000/8000 or the real DB**; the isolated stack is
  `npm run e2e:start -- --seed` / `e2e:stop` on 3100/8100 (see `scripts/e2e-stack.mjs`). A backup of the real DB is in the scratchpad
  (`app.db.backup-before-ai-chat`).
- Shell quirks: don't use `bash -c '...'`; **big heredocs with quotes break, use the Write tool for multi-line files**; `cd` persists between
  Bash calls; use absolute paths. The built-in browser: wait for slide animations (about 2 s) before typing or pressing keys, `resize_window`
  1440x900 helps, `computer` wait max is 10 s, coordinates follow the latest screenshot.
- TDD is the standing rule: write the test, watch it fail for the right reason, then implement; verify with real runs before claiming done.

## 4. Where things stand
**On `main` and deployed (commit `00485cb`):** Phases 0 to 2 (question types registry with 21+ types, groups, multiple endings, welcome options,
themes and theme editor, images via Cloudinary, picture choice) and the **Typeform AI chat**: `POST /api/ai/chat|apply`, `GET/PUT /api/ai/memory`
(`backend/app/services/ai_{form,chat,apply,client,schemas}.py`), UI in `frontend/components/ai/*` and `frontend/lib/ai/*`: the "Chat to create" bar
in the builder, "Create with AI" tab, blank-form start screen, workspace "Ask Typeform AI" box, review view (chat, Suggested changes, Preview,
versions, Apply, memory). Also the migration `rename_theme_color_keys` that fixed a production 500 on `GET /api/forms`.
**The owner must set `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`, default `gemini-3.5-flash-lite`) in Railway's variables**; until then the live
chat answers a friendly 503. Verify with a read-only `curl .../api/ai/chat` (expect 200 after the key is set).

**On local branch `feat/onboarding`, UNCOMMITTED (nothing pushed):** the first-visit onboarding, built and browser-verified:
- `frontend/lib/onboarding.ts` (+ `.test.ts`): profile model (name, role, goals), tolerant parse/validate, initials, `suggestedPrompt`,
  `createOnboardingStore` (localStorage key `typeform-clone:onboarding`, blocked-storage fallback, cross-tab sync).
- `frontend/lib/useOnboarding.ts`, `frontend/lib/ai/launcher.ts` (zustand store so the closing screen can open the AI chat with a prompt).
- `frontend/components/onboarding/` (`OnboardingGate` mounted in `app/(dashboard)/layout.tsx`, `OnboardingExperience`, `OnboardingDone`,
  `onboardingQuestions.ts`): welcome screen, then three questions run by our own `RespondentFlow` on a dark theme with drifting lilac glows
  (CSS in `globals.css`), then "You're all set, <name>!" with "Create my first form with AI" / "Explore my workspace".
- `frontend/components/dashboard/AccountMenu.tsx` + `TopNav.tsx`: the account chip shows the visitor's name and initials ("Default creator" when
  skipped) and has **"Restart intro"** (how to replay it for a demo). `WorkspaceSidebar.tsx` also opens the AI view from the launcher.
- Verified in the browser: welcome, 3 questions, closing screen, persistence after reload (no repeat), name/initials in the top bar,
  Restart intro, Skip. Tests: `lib/onboarding.test.ts` (18) and `lib/onboardingRender.test.ts` (8).
- **To do for onboarding:** commit it (owner hasn't said yet), then merge/push on request; check the mobile layout (375 px) and a keyboard-only pass;
  optional polish (a short tour, replay link elsewhere). The role question is single choice with auto-advance: pressing two letters quickly
  changes the answer (that's the engine, not a bug).

**Parked in `git stash@{0}`** ("parked 2026-10-09: parallel wave 1"): half-built logic v2 (backend `schemas/logic.py`, TS resolver, the golden fixture
`backend/tests/fixtures/logic_cases.json`, scoring helpers), templates API, share helpers (QR, social). Resume with `git stash pop` on a clean
tree after reading `docs/superpowers/specs/2026-10-09-phase3-logic-design.md` (written, approved in principle; sections 1a and 11 list the cuts).

## 5. What to build next (suggested order for a 24-hour clone; effort in hours)
1. Share page (`/forms/[id]/share`): link, QR, embed modes (popup, slider, side tab) and `public/embed.js` (3). Measured layout is in `docs/design/typeform-live-reference.md`.
2. Templates gallery + "Start from a template" in the create flow, about 16 original templates (3).
3. Form settings dialog (gear): progress bar, arrows, question numbers, open/closed, editable system messages. **Fully measured** in
   `docs/design/typeform-form-settings-reference.md` (3).
4. Workspace polish: sort menu, search dialog, row menu (copy link, duplicate, move), shimmer rows (2).
5. Logic (branching with and/or, jump to endings, scoring, variables, `@` recall, URL parameters): the parked work + spec; Typeform's Workflow
   tab is measured in `docs/design/typeform-live-reference.md` (last section) (6 to 8).
6. Results rebuild (Form performance tab, filters, Excel download), Connect tab (catalog + webhooks) (3 each).
7. Extras: logic map canvas, version history, accessibility checker, keyboard shortcuts, mobile layouts, an optional marketing landing page before
   the onboarding.
Everything cut or pending is listed in **`docs/superpowers/DEFERRED.md`**; keep it updated.

## 6. Known issues and gotchas
- The builder's left column shows **"Endings" twice** (a leftover local `EndingsCard` in `components/builder/FormBuilder.tsx` still reads
  `form.thank_you`); remove it.
- Junk files `tmp_seed_themes.py`, `tmp_theme.py` at the repo root were committed in `2e647c5`; delete them.
- The owner's real DB has test form id 3 "Coffee Shop Feedback" (created by the AI check) plus their own "Customer feedback" and "manpreet_test".
- The AI chat can't edit rules, groups, design, picture choice or matrix questions yet (it says "not supported yet"); no mic dictation.
- Docs to read when relevant: `docs/design/typeform-free-features-audit.md` (what's free, default texts), `docs/API_SPEC.md` (new AI section at the end),
  `docs/superpowers/specs/2026-10-09-typeform-parity-design.md` (program spec D1 to D12), `docs/superpowers/DEFERRED.md`.
- Project memory (auto-loaded for the same user): `C:\Users\HP\.claude\projects\C--Users-HP-OneDrive-Desktop-typeform\memory\`.

## 7. Paste this into the new chat
> You are continuing a Typeform clone in `C:\Users\HP\OneDrive\Desktop\typeform` (Next.js 16 + FastAPI + SQLite). First read `docs/HANDOFF-NEXT-CHAT.md`,
> then `docs/superpowers/DEFERRED.md`. State: AI chat is merged, pushed and deployed; the first-visit onboarding is built and verified on the local branch
> `feat/onboarding` but not committed. Rules: one feature at a time, no subagents, test-first, commit/push only when I say, never print keys, Typeform's
> site is read-only. Start by asking me whether to commit the onboarding, then continue with the next feature I choose from section 5.
