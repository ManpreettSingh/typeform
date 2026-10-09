# Typeform free-plan parity: program design

Date: 2026-10-09 · Status: **draft for review** · Companion docs: `docs/design/typeform-free-features-audit.md`
(what is free, measured data, gap table), `docs/design/typeform-live-reference.md` (measured layout, colors, motion),
`docs/HANDOFF.md` (state of the redesign).

## 1. Goal

Make the local app look and behave like admin.typeform.com on the free plan (features, layout, colors, motion), then
deploy it.

- Features that are paid on Typeform appear **where Typeform shows them, disabled, with a "Soon" badge**.
- Images use **Cloudinary**. Every AI feature uses **Gemini (Flash-Lite) called from the backend**; no key ever reaches
  the browser.
- Order requested by the owner: all main features first, then AI in every place, then deployment.

**Done means**, for each phase and for the whole program:
1. Side by side with Typeform at 1440×900 (light mode) the covered screens show no visible difference in fonts, spacing,
   colors, states or motion.
2. Every feature of the phase works end to end (builder → preview → live form → results).
3. `npm run test:backend`, `npm run typecheck`, `npm run lint` pass and the phase's browser checks pass on the isolated
   ports (3100/8100).
4. The owner has looked at it on localhost:3000.

## 2. Scope

In: everything free in the audit (question types, welcome/endings, logic with scoring and variables, URL parameters,
recall, themes, images, form settings, share and embed, results, downloads, test responses, webhooks, templates, version
history, accessibility checker, Typeform AI).
Shown as "Soon" (disabled): every paid feature, the Contacts / Automations / Insights / Pages / Research Flow tabs, Brand
kit, Invite, and the third-party integration catalog (except webhooks and email notifications, which are real).
Out: accounts, sign-in, plans and billing.

## 3. How we copy Typeform exactly (the parity loop)

For every screen: (1) capture Typeform at 1440×900 light, screenshot plus computed styles of the key elements, and note
them in the live reference; (2) build it from tokens only (`globals.css`); (3) capture ours at the same size; (4) compare
and fix until there is no visible difference; (5) copy motion (duration, easing) from the approved motion gallery or
measure it. Typeform is read-only for us: we open dialogs and panels, we never save, send or delete there. Dark mode
stays as our extra (Typeform has none). The respondent font stays Inter (Typeform's TWK Lausanne is licensed).

## 4. Architecture decisions

**D1. One type registry drives everything.** Backend `app/question_types/` has one module per type with: its properties
model and defaults, answer validation and cleaning (with Typeform's default error messages), stats summary, CSV/XLSX
formatting, sample answers (test responses, seed), supported logic conditions and a schema snippet for the AI. The
services (`validation`, `stats`, `export`, `logic`, `test_responses`, `ai`) read the registry instead of branching per
type. Frontend `lib/questionTypes/` mirrors it (label, icon, chip color, defaults, settings panel, respondent answer
component, client validation, formatter, summary card) and is checked with `satisfies Record<QuestionType, …>`. A pytest
contract test fails if the two lists of types differ. Adding a type later touches one backend module and one frontend
module.

**D2. Block model and database.**
- `questions.type` loses its SQL CHECK (the Pydantic enum validates). Existing databases get a one-time, tested table
  rebuild (foreign keys off, copy, swap, indexes, `foreign_key_check`).
- New nullable columns: `questions.media` (JSON), `questions.group_id` (self foreign key, cascade).
- **Question Group** = a `group` row (header text, button text) followed in the flat `position` order by its children.
  Respondents still see a flat sequence of questions with the group header above each child; the group row collects no
  answer and never appears in results or exports; deleting the header deletes its children (with a confirmation), as in
  Typeform.
- **Statement** = a question row with no answer (never in results).
- **Welcome screen**: keep `title`/`description`, add `forms.welcome` JSON (button text, time-to-complete switch,
  submission-count switch, media).
- **Endings**: new `endings` table (position, title, description, media, button) replacing `forms.thank_you`; the existing
  thank-you data becomes the first ending. Our ending button with a link stays (a superset of Typeform's free plan).
- `forms.settings` JSON (display switches, preferences, notifications, access), `forms.system_messages` JSON (overrides of
  the default texts in the audit §4), `forms.variables` JSON, `forms.url_parameters` JSON (names).
- Composite answers (contact info, address, matrix, ranking) are objects or arrays in the existing `answers.value` JSON.

**D3. Images (Cloudinary).** The browser uploads to our backend (`POST /api/media`, multipart, JPG/PNG/GIF, ≤ 4 MB,
≤ 2560×2560, same as Typeform); the backend validates, uploads with the API secret and stores a `media_assets` row
(public id, size, type, created) that powers **My gallery**. Settings are `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`,
`CLOUDINARY_API_SECRET` (a `CLOUDINARY_URL` string is accepted too). A block's `media` holds
`{attachment: {type, public_id, url, alt, focal_point, brightness, scale}, layout: {type: stack|split|float|wallpaper,
placement: left|right}, viewport_overrides: {small, large}}`, the same shape as Typeform's Create API. Delivery URLs add
Cloudinary transformations by context (703 px for questions, 800 px for welcome and endings, 460 px on mobile, picture
choice 230/310 px, backgrounds 1680×1050 desktop / 1024×768 tablet / 480×320 mobile). The Unsplash, Pexels,
YouTube/Vimeo and icon tabs and the crop/rotate/filter editor are a later step inside Phase 2 and need extra keys.

**D4. Logic engine v2.** A rule has conditions (AND/OR over answers, variables, URL parameters) and actions (jump to a later
question or an ending; set / add / subtract / multiply a variable). Variables: built-in `score` and `price` plus custom
number or text variables. Scoring quiz writes `score` from per-answer points; the outcome quiz maps answers to endings and
shows the highest. Recall tokens (`{{field:<id>}}`, `{{var:<name>}}`, `{{param:<name>}}`) are resolved while the form runs
and inserted from the builder's `@` picker. Jumps stay forward-only, so a form can never loop. `lib/logic.ts` and
`services/logic.py` remain mirrored implementations of the same resolver.

**D5. Form settings and system messages.** Stored in `forms.settings` / `forms.system_messages` and honored by the
respondent: progress bar, arrows, question numbers, required asterisks, letters on answers, autosave progress (resume
after reload), free navigation, cookie-consent banner, open/closed switch (closed message), and every default text from the
audit §4 (editable per form).

**D6. Share and embed.** A Share page (link, QR code via a small client library, social links, link preview) and an embed
generator for Standard, Full-page, Popup, Slider, Popover and Side tab, backed by a tiny `public/embed.js` that builds the
iframes. Email embed snippet. The publish animation from the approved motion gallery.

**D7. Results.** Form performance, response summary, responses table with the docked panel, search and filters, CSV and XLSX
download (`openpyxl`), generate test response, delete selected. Per-type summaries come from the registry.

**D8. Connect.** The integration catalog is a static list (our own wording, categories and counts like Typeform's) with
"Connect" buttons marked Soon. Two real parts: **webhooks** (`webhooks` and `webhook_deliveries` tables, delivery from a
background task with retries) and **email notifications** (SMTP settings from the environment; without SMTP the settings
say so and nothing is sent).

**D9. Templates.** About 16 original templates (our own questions, written for Typeform's categories) stored as JSON in
`backend/app/templates/`, listed by `GET /api/templates`, applied by `POST /api/forms/from-template/{slug}`; a gallery page
with Typeform's Role / Goal / Form-type filters.

**D10. Typeform AI (Gemini).** One chat endpoint sends Gemini the current form (in our own draft shape built from the
registry), the conversation and the creator's memory, and gets back a reply plus a proposed form. The server validates the
proposal with the same models as manual edits and returns the diff (questions to be removed / to be set). **Apply** saves it
in one transaction; the client keeps earlier proposals so a previous version can be restored. It can add, edit, reorder and
delete questions, edit endings and settings, add or change branching rules, and suggest improvements; like Typeform it
declines design changes. Entry points: the start screen, "Chat to create", "Ask Typeform AI" in the workspace, and the
Create with AI tab. Model id from `GEMINI_MODEL` (default `gemini-3.5-flash-lite`, confirmed available for the owner's key).

**D11. Secrets and config.** Only `backend/.env` (git-ignored) and Railway variables hold keys. The frontend needs just
`NEXT_PUBLIC_API_URL`. `.env.example` lists every variable.

**D12. Migrations.** `migrate()` grows into an ordered list of small, idempotent steps (added columns, CHECK removal, moving
`thank_you` into `endings`). Each step has a test that starts from a database created with the previous schema; before
deployment the whole chain runs against a copy of the production database.

## 5. Phases

Each phase ends with a checkpoint: tests green, side-by-side comparison done, the owner checks localhost:3000. Each phase
gets its own short task plan (files, tests) before it starts.

**Phase 0: stable local stack and test harness.** Restart instructions for the dev server (its worker process died after about
two hours of memory pressure); an isolated stack on 3100/8100 with a throwaway database; fake Cloudinary and fake Gemini
servers so tests never wait on keys; browser-check scripts. *Done:* a smoke run passes on 3100/8100.

**Phase 1: content model and every free question type.** D1 and D2; Add content shows every free item enabled and paid ones as
Soon; Pages list as Typeform's cards; the new types (Contact Info, Phone Number, Address, Website, Legal, Checkbox, Date,
NPS, Opinion Scale, Ranking, Matrix, Statement, Question Group; Picture Choice completes in Phase 2); extra settings on the
existing types (Other / None of the above, selection limits, rating shapes); change a question's type; welcome-screen options;
multiple endings; results and exports per type. *Done:* each type can be added, edited, previewed, answered by keyboard and
seen in summary, table and CSV.

**Phase 2: images and design.** D3 plus the design side: gallery of the 30 free themes, custom theme editor (colors, font,
text size, background image), Picture Choice, mobile and desktop previews. *Done:* a real upload to Cloudinary appears on a
question, the welcome screen, an ending and a Picture Choice answer, in all four layouts.

**Phase 3: logic and workflow.** D4: logic map, multiple rules, AND/OR, jump to ending, variables, scoring, outcome quiz, recall,
URL parameters. *Done:* three respondent paths per feature behave correctly (checked in the database).

**Phase 4: share, results, settings, connect, templates, workspace.** D5 to D9, the Form settings dialog, version history,
accessibility checker, workspace parity (search dialog, shimmer rows, sort menu, Integrations column, "Ask Typeform AI" box,
Copy to / Move to with more than one workspace), view recording. *Done:* each screen matches side by side; embed modes work
on a sample page; a webhook reaches a local listener.

**Phase 5: Typeform AI everywhere.** D10. *Done:* a real Gemini run from every entry point; proposals validate; Apply persists;
memory persists; unsupported requests are declined politely.

**Phase 6: deployment.** Back up the production database and run the migration chain on a copy; the owner adds the Gemini and
Cloudinary variables on Railway; push; confirm both deployments succeed; smoke-test the live site; keep the previous commit
as the rollback. *Done:* the live site shows the new features and the existing data is intact.

## 6. Verification

- Python tests (pytest, temporary database) for every service, migration and endpoint; Cloudinary and Gemini calls mocked.
- Frontend: `tsc --noEmit` and ESLint.
- Browser checks (Playwright with Edge, scripts outside the repo) on 3100/8100 against throwaway data and the fake servers;
  real Cloudinary and Gemini smoke tests once, with the owner's keys.
- Side-by-side screenshots against Typeform for every screen in the phase.
- Resource limits: this machine runs near its memory limit, so only one heavy process at a time and no large scratch copies.

## 7. Risks

- **Size.** Six phases are many sessions. Phase checkpoints and an updated `docs/HANDOFF.md` after each phase keep it resumable.
- **Local dev server stability** (worker crash seen today); mitigated by restarts and a lighter e2e stack.
- **Production data.** A SQLite table rebuild must be rehearsed on a copy and backed up first.
- **Typeform changes under us** (they A/B test layouts and plans); measurements are dated.
- **Third-party limits:** Cloudinary free tier, Gemini rate limits, extra libraries (phone numbers, flags, QR).
- **Legal.** This is an unofficial clone: images and templates are original; the Typeform mark stays in the creator UI only.

## 8. Working agreements

- No commits or pushes until the owner says so (one commit per phase is the suggestion).
- Keys only in `backend/.env` and Railway, never in chat or git.
- Typeform stays read-only. To copy each question type's right-hand panel exactly, one scratch form in the free account would
  help (add each type once); without it the panels are copied from the help articles.
- Docs (`PROGRESS.md`, `API_SPEC.md`, `DATABASE_SCHEMA.md`, README) are updated at the end of each phase.
