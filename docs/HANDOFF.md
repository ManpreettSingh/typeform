# Handoff: Typeform redesign, phase 2 (screens 3–7)

Written 2026-10-09 so another session can continue. Read this and `docs/design/typeform-live-reference.md`
(the measured Typeform spec) first. Previous work: commits up to `0942d22` (workspace + builder redesign).

## User's instructions (keep following them)
- Copy Typeform's real design strictly, **including animations**, for everything not yet matched.
- "Create with AI" uses **Gemini Flash-Lite**. The user adds `GEMINI_API_KEY` to `backend/.env` themselves. Default model `gemini-3.5-flash-lite` (latest stable Flash-Lite per ai.google.dev, Oct 2026), overridable with `GEMINI_MODEL`.
- The user's own dev servers (3000/8000) use the real `backend/app.db`. Don't write test data there without asking. Test on 3100/8100 (see memory notes / PROGRESS.md).
- The user allowed killing/restarting the dev servers when needed.
- A logged-in Typeform session exists in the Claude app's built-in browser (tab at admin.typeform.com). Read-only browsing only; don't create, publish, or delete there.
  - My click on Typeform's "Create form" created an extra draft **"New form" (id `DaXKht1o`)** in the user's Typeform account. Tell the user; they may delete it.

## Done in this session (uncommitted)
**Backend** (all 118 tests pass: `npm run test:backend`)
- `forms.views` column + `migrate()` in `app/core/db.py` (adds missing columns to an existing app.db at startup; already applied to the user's DB).
- `POST /api/public/forms/{slug}/views`: counts a visit (published forms only).
- Summary (`GET /forms/{id}/summary`) now has `views` and `average_seconds` (time to complete; one-shot submissions without a partial start are excluded). Text summaries return **all** answers with timestamps: `answers: [{value, submitted_at}]` (replaces `recent`).
- `POST /api/forms/{id}/responses/test`: Typeform's "Generate test response" (random valid answers that follow branching; `meta: {"test": true}`; works on drafts; 400 when there are no questions). `app/services/test_responses.py`.
- Typeform AI with Gemini: `app/services/ai.py`, `app/routers/ai.py`.
  - `POST /api/ai/forms {prompt}` creates a new form from the prompt (deleted again if AI fails).
  - `POST /api/ai/forms/{id}/questions {prompt}` appends questions, names a "New form" and adds a welcome line if empty.
  - Errors: 503 without a key (setup message), 502 with a clear message for a bad key, 429, an unknown model, unusable JSON, or no questions. Tests in `tests/test_ai.py` mock `httpx.post`.
- Default form title is now **"New form"** (Typeform's).
- `.env.example` documents `GEMINI_API_KEY` / `GEMINI_MODEL`.
- `package.json` `dev:backend` has `--timeout-graceful-shutdown 1`. Without it, uvicorn's `--reload` on Windows hung at "Reloading..." (keep-alive connections) and kept serving stale code. That caused the "button_color of undefined" crash the user saw.

**Frontend** (started; not yet typechecked)
- Tokens (`app/globals.css`): Typeform system font stack for the admin UI (respondent keeps Inter), `--radius-input` 8px, `--radius-row` 12px, default transitions 200ms `ease`, overlay `rgb(70 62 72 / .7)`, modal shadow = 3px ring.
- `Button`: new `lg` size; radius per size; removed `duration-150` everywhere (default 200ms applies).
- Types: `FormSummary.views/average_seconds`, `TextSummary.answers`, `AiPrompt`.
  - `QuestionSummaryCard` now reads `answers` (a stopgap until the results rebuild). `npx tsc --noEmit` passes.
- Queries: `useGenerateTestResponse` (results.ts), `publicApi.recordView` (public.ts), `aiApi` + `useCreateFormWithAi` + `useAddAiQuestions` (forms.ts).

## Remaining plan (in order)
1. **Shared form header** `components/form/FormTopBar.tsx` (breadcrumb, tabs Content/Workflow/Connect/Share/Results with a top 3px bar; routes: content/workflow/connect → `/forms/[id]/edit?view=…`, share → `/forms/[id]/share`, results → `/forms/[id]/results`). Use it in the builder (refactor `BuilderTopBar`; read `?view=` in `FormBuilder`) and replace `ResultsHeader`.
2. **Share page** `app/forms/[id]/share/page.tsx`: landing + detailed view (`?tab=link|embed|email`), link preview, social share links (inline brand SVGs; lucide 1.x has no brand icons), embed code generator (iframe of `/f/slug`, Standard/Full-page, width/height) with live preview, email embed snippet, draft banner + Publish. Replace `ShareFormModal` uses (builder Share tab, results "Share your form", workspace menu) with navigation to this page.
3. **Publish → Share celebration** (approved in `docs/design/mockups/motion-gallery.html`, lines 45–95 and 231–293): button swaps to spinner (blur/opacity 200ms) → green `#177767` + check draws in (stroke-dashoffset 320ms) "Published" → burst of 26 particles in the qt colors + `#3c323e`/`#177767` (fixed-position, WAAPI 800–1050ms, ease `cubic-bezier(.23,1,.32,1)`) → go to the share landing (`?published=1`): children rise in (opacity + translateY 12px, 320ms, staggered 60ms), the link writes in (clip-path 420ms, 220ms delay), Copy link gets one ring (700ms, 560ms delay) → toast "Your form is live". Reduced motion: no burst or movement, fades only.
4. **Results rebuild** to the spec: sub-tabs (Form performance #insights default, Response summary #summary, Responses [n] #responses) with the bottom bar; performance cards (Views/Starts=total_responses/Submissions=completed/Completion rate/Time to complete mm:ss, "—" when null); summary (sort + #/% toggles, text search + answer cards with relative times, choice bars, rating, number, "Waiting for responses"); responses table (segmented All | Partial via `?status=`, search, CSV download icon, Generate test response, checkbox selection + bulk delete, two-line time, type badge, qt icons in headers, hover expand icon) + **docked** response panel (instant, ↑↓, ⋮ Delete, ✕, answer cards, Response ID); empty state "No responses" + Share your form + Generate test response.
5. **AI UI**: `components/ai/AiPromptBox.tsx` (halo + typewriter placeholder + send; hero and single-line "bar" variants; loading = halo pulse + "Creating your form…"; error text below). Create flow: "Create form" creates "New form" immediately and opens the builder; an empty form shows the AI start screen (Start from scratch → dismiss + open Add content). Add content gets a "Create with AI" tab (prompt + 3 template cards that prefill prompts). Builder "Chat to create" bar under the canvas. Workspace sidebar "Ask Typeform AI" → `useCreateFormWithAi` → builder. After AI in the builder, adopt the returned form into `builderStore` (add an action that sets form/questions/saved* like `loadForm`) and select the first new question. Add tokens `--ai-halo #f9f2fd`, `--ai-line #ddb7f0` (+ dark variants).
6. **Respondent**: call `publicApi.recordView(slug)` once per visit in live mode (ref guard for StrictMode). Re-check the pending respondent motion: old question rises out 250ms, new rises in 350ms; the progress bar scales.
7. **Error/empty states**: `app/error.tsx`, `not-found.tsx`, `global-error.tsx`, builder/results "Form not found" to Typeform's error layout.
8. **Workspace**: search as a dialog (spec above), shimmer skeleton rows, 12px row radius (token done).
9. **Builder pages list**: each page as its own card like Typeform (optional polish).
10. Verify: `npm run typecheck`, `npm run lint`, `npm run build:frontend` (clear `frontend/.next/cache/turbopack` first if CSS looks stale), backend tests, browser checks on isolated ports 3100/8100. Update `docs/PROGRESS.md`, API_SPEC.md (new endpoints), README (Gemini setup). Commit when the user asks.

## Useful facts
- Next 16 + Tailwind v4 (tokens only in `globals.css`), React 19, framer-motion, sonner, zustand, TanStack Query. Read `frontend/node_modules/next/dist/docs/` before using Next APIs. `cacheComponents` is on, and `<Activity>` keeps hidden routes mounted, so reset transient UI in a `useLayoutEffect` cleanup.
- The dev stack runs with `npm run dev` (concurrently -k). Kill by PID tree (`taskkill /T /F`), never by image name. C: drive is low on space (~5 GB free).
