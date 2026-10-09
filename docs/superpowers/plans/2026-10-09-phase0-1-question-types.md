# Phase 0–1: test stack, type registry and every free question type: implementation plan

> **For agentic workers:** execute task by task with `superpowers:executing-plans` (native, in this session). Steps use
> checkbox syntax. Tick a box when its result is verified.

**Goal:** an isolated test stack, one registry that owns everything per question type, and all free Typeform question types
(plus groups, welcome options, multiple endings, change-type) working from builder to results.

**Architecture:** backend `app/question_types/` (one spec per type) feeds validation, stats, export, logic, sample answers
and AI schema; frontend `lib/questionTypes/` (pure data and logic) plus `components/questionTypes/` (React components)
mirror it. Structure changes (groups, endings, welcome) are columns/tables added by ordered migrations.

**Tech Stack:** FastAPI, SQLAlchemy 2 (SQLite), Pydantic v2, pytest; Next 16, React 19, Tailwind v4, TanStack Query,
Zustand, framer-motion. New libraries: `phonenumbers` (backend), `libphonenumber-js` and `country-flag-icons` (frontend).

**Spec:** `docs/superpowers/specs/2026-10-09-typeform-parity-design.md` (D1, D2, Phases 0–1). Measured data:
`docs/design/typeform-free-features-audit.md`, `docs/design/typeform-live-reference.md`.

## Global Constraints

- Free types to add in this phase (13): `contact_info`, `phone_number`, `address`, `website`, `legal`, `checkbox`, `nps`, `opinion_scale`,
  `ranking`, `matrix`, `date`, `statement`, `group` (header block). `picture_choice` arrives in Phase 2 together with images and shows
  as "Soon" until then.
- Paid items appear in Add content **disabled with a "Soon" badge**: Video and Audio, Clarify with AI, FAQ with AI, Signature,
  Payment, File Upload, Scheduler, Partial Submit Point, Redirect to URL. Nothing paid is built.
- Default error texts are Typeform's (audit §4): "Please fill this in" · "Hmm... that email doesn't look right" ·
  "Hmm… that web address doesn’t look right. Check for any typos or errors." ·
  "Hmm... that phone number doesn't look right" · "Choose a date on or after {min}." / "on or before {max}." /
  "between {min} and {max}." · "That date doesn't look valid—it's incomplete or doesn't exist" ·
  "Please agree to the terms & conditions" · "Oops! Please make a selection". Existing messages for the 8 current types do not change.
- Typeform's chip colors: contact = pink, choice (incl. legal, checkbox, yes/no) = lavender, rating & ranking (incl. NPS,
  opinion scale, matrix) = green, text = blue, other (number, date) = yellow, screens (welcome, statement, group, endings) = gray.
- Group semantics (Typeform): a header row followed by its children in the flat order; respondents see the header above each
  child; the group collects no answer and never appears in results or exports.
- Tests run on a temporary database; browser checks run on ports **3100/8100** only (never 3000/8000, which are the owner's).
- No commits or pushes. Keys never in chat or git. Typeform is read-only.
- The machine is near its memory limit: run one heavy process at a time (pytest, then tsc, then lint, never a build alongside).

## Review Focus

1. **Existing data survives the migrations**, including a second run: a populated old-schema database keeps forms, questions,
   responses and answers; the old thank-you becomes the first ending. (Task 2)
2. **Stale ids after edits**: answers naming a removed option, row or column must still render in summary, table, drawer and
   CSV as "(removed choice)" and never crash. (Tasks 3, 8, 9)
3. **Validation edge cases**: phone numbers without a country or with spaces, URLs without a scheme or with `javascript:`,
   Feb 29, swapped day/month formats, end date before start date. (Tasks 5, 6)
4. **Groups**: deleting a header with children, dragging a child out, a header with no children (skipped by the respondent),
   a jump aimed at a header. (Task 11)
5. **Composite answers with some sub-fields empty** and per-field required flags; keyboard flow must not submit mid-field. (Task 9)

---

## Phase 0

### Task 1: Isolated test stack

**Files:**
- Create: `scripts/e2e-stack.mjs`
- Modify: `frontend/next.config.ts` (add `distDir: process.env.NEXT_DIST_DIR ?? ".next"`), `frontend/.gitignore` (add `/.next-e2e/`), `package.json` (scripts `e2e:start`, `e2e:stop`, `e2e:status`)

**Interfaces:**
- Produces: `node scripts/e2e-stack.mjs start|stop|status`. `start` refuses if 3100 or 8100 is in use, starts uvicorn on 8100
  (`DATABASE_URL=sqlite:///<temp>/e2e.db`, `CORS_ORIGINS=http://localhost:3100`) and `next dev -p 3100` with
  `NEXT_PUBLIC_API_URL=http://localhost:8100/api`, `NEXT_DIST_DIR=.next-e2e`; waits until `/api/health` and `/forms` answer;
  stores PIDs in `<temp>/typeform-e2e/pids.json`; `stop` kills each PID tree (`taskkill /T /F /PID`); `status` prints both URLs and PIDs.

- [ ] **Step 1: Implement the script and the `distDir` option**; one file, no dependencies beyond Node built-ins.
- [ ] **Step 2: Verify:** `npm run e2e:start` prints both URLs; `curl http://localhost:8100/api/health` returns `{"status":"ok"}`;
  `curl -o /dev/null -w "%{http_code}" http://localhost:3100/forms` returns 200; the owner's 3000/8000 are untouched
  (`Get-NetTCPConnection` shows them with the same PIDs as before); `npm run e2e:stop` frees 3100 and 8100.

---

## Phase 1A: foundation

### Task 2: Ordered migrations, new columns and the `endings` table

**Files:**
- Create: `backend/app/core/migrations.py`, `backend/app/models/ending.py`, `backend/tests/test_migrations.py`,
  `backend/tests/fixtures/schema_v1.sql` (the CREATE statements of the current schema, generated before any model change)
- Modify: `backend/app/core/db.py` (`migrate()` calls the ordered steps), `backend/app/models/{question,form,__init__,enums}.py`

**Interfaces:**
- Produces: `MIGRATIONS: list[tuple[str, Callable[[Connection], None]]]` in `migrations.py`, applied in order by `migrate()`;
  steps: `add_forms_views` (existing), `drop_question_type_check`, `add_questions_group_id`, `add_forms_welcome`,
  `create_endings_from_thank_you`.
- `Question.group_id: int | None` (self FK, `ondelete="CASCADE"`); `Form.welcome: dict` (JSON, default `{}`);
  `Ending(id, form_id, position, title, message, button_text, button_url)` with `Form.endings` ordered by position;
  `QuestionType` gains the 13 new values; the SQL CHECK on `questions.type` is gone from the model.

- [ ] **Step 1: Write the failing tests** in `test_migrations.py`:
  `test_old_database_keeps_all_rows` (load `schema_v1.sql`, insert 1 form + 3 questions + 2 responses + answers, run `migrate()`,
  assert counts equal and `PRAGMA foreign_key_check` is empty); `test_new_types_are_insertable_after_migrate`
  (insert a question with `type="phone_number"` succeeds); `test_thank_you_becomes_first_ending`
  (`endings` has 1 row per form with the old title/message); `test_migrate_twice_is_a_noop` (second run changes nothing).
- [ ] **Step 2: Run** `npm run test:backend -- tests/test_migrations.py -q`; expected: FAIL (module missing).
- [ ] **Step 3: Implement** the steps; `drop_question_type_check` follows SQLite's 12-step rebuild (foreign keys off, create
  `questions_new` without the CHECK, copy, drop, rename, recreate `uq_questions_form_position`, `foreign_key_check`), detected by
  looking for `ck_questions_type` in `sqlite_master.sql`.
- [ ] **Step 4: Run the new tests and the full suite**; expected: all pass (118 existing + new).
- [ ] **Step 5: Checkpoint:** tick this task; note the migration chain in `docs/DATABASE_SCHEMA.md`.

### Task 3: Backend type registry (no behavior change)

**Files:**
- Create: `backend/app/question_types/{__init__,base,text,numeric,choice}.py`, `backend/tests/test_registry.py`
- Modify: `backend/app/schemas/properties.py`, `schemas/logic.py`, `services/{validation,stats,export,logic,test_responses,ai}.py`

**Interfaces:**
- Produces in `question_types/base.py`:
  `class AnswerError(ValueError)`; `@dataclass(frozen=True) class QuestionTypeSpec` with fields
  `key: QuestionType`, `properties_model: type[BaseModel]`, `answerable: bool`, `defaults: Callable[[], dict]`,
  `validate: Callable[[Any, dict], Any] | None` (returns the value to store, raises `AnswerError`),
  `format: Callable[[Any, dict], str]`, `summarize: Callable[[Question, list[Any], list[datetime]], QuestionSummary] | None`,
  `sample: Callable[[dict, random.Random], Any] | None`, `logic_ops: frozenset[str]`,
  `logic_match: Callable[[str, Any, Any, dict], bool] | None` (op, rule value, answer, properties),
  `logic_value_error: Callable[[Any], str | None] | None`.
  `question_types/__init__.py`: `SPECS: dict[QuestionType, QuestionTypeSpec]`, `get_spec(type: str) -> QuestionTypeSpec`.
- Consumes: nothing new. The 8 existing types move into the registry with identical behavior and messages.

- [ ] **Step 1: Write `test_registry.py`:** `test_every_type_has_a_spec` (every `QuestionType` in `SPECS`);
  `test_samples_validate_against_their_own_spec` (for each answerable type: `validate(sample(defaults(), Random(1)), defaults())`
  does not raise); `test_format_returns_text` (for each sample, `format(...)` is a non-empty `str`);
  `test_ops_match_logic_schema` (`spec.logic_ops == OPS_BY_TYPE[type]` for the 8 existing types, before the schema is rewired).
- [ ] **Step 2: Run it**; expected FAIL.
- [ ] **Step 3: Implement the package** by moving the per-type code from `properties.py`, `validation.py` (`VALIDATORS`),
  `stats.py` (`_SUMMARIZERS`), `export.py` (`format_answer`), `logic.py` (`rule_matches`), `schemas/logic.py` (`OPS_BY_TYPE`,
  `_value_error`) and `test_responses.py` (`_answer`); the old modules keep their public functions as thin lookups
  (`validate_answer`, `summarize_question`, `format_answer`, `rule_matches`, `default_properties`, `validate_properties`).
- [ ] **Step 4: Run the full suite**; expected: the 118 existing tests pass unchanged plus the new ones.
- [ ] **Step 5: Add the AI schema hook:** `services/ai.py` builds its `type` enum from `SPECS` where `answerable`; test
  `test_ai.py` still passes.

### Task 4: Frontend type registry (no behavior change)

**Files:**
- Create: `frontend/lib/questionTypes/index.ts`, `frontend/components/questionTypes/index.tsx`
- Modify: `frontend/lib/{types,validation,logic,answerFormat}.ts`, `frontend/lib/questionTypes.ts` (becomes a re-export),
  `components/respondent/QuestionRenderer.tsx`, `components/builder/QuestionSettings.tsx`, `components/results/QuestionSummaryCard.tsx`

**Interfaces:**
- Produces: `lib/questionTypes/index.ts`: `QuestionTypeDef<T>` = `{ label, icon, chip, group, answerable, validate(q, value): string|null,
  format(q, value): string, ops: LogicOp[], ruleMatches(rule, value): boolean, toSubmission?(value): unknown }` and
  `QUESTION_TYPE_DEFS: { [T in QuestionType]: QuestionTypeDef<T> }`, `getDef(type)`;
  `components/questionTypes/index.tsx`: `ANSWER_COMPONENTS`, `SETTINGS_COMPONENTS`, `SUMMARY_COMPONENTS`, each
  `satisfies Record<QuestionType, ComponentType<...>>` so a missing type is a compile error.

- [ ] **Step 1: Move** per-type `switch` code into the definitions; keep the exported helper names (`validateAnswer`, `formatAnswer`,
  `ruleMatches`, `OPS_BY_TYPE`, `QUESTION_TYPE_META`) as thin lookups so callers don't change.
- [ ] **Step 2: Verify:** `npm run typecheck` and `npm run lint` exit 0; the workspace and builder still render (browser check on 3100).

---

## Phase 1B: simple answer types (each task = backend module, frontend module, tests, browser check)

For every type below, the task delivers: backend spec (properties model, defaults, validate, format, summarize, sample, logic ops),
frontend definition (validate mirrors server, format, ops), respondent answer component, builder settings panel (Typeform-style
switch rows), canvas rendering, summary card, Add content item enabled, and tests listed. The type's chip color and icon follow the
Global Constraints. Browser check = add it in the builder on 3100, answer it by keyboard on `/f/<slug>`, see it in Results and CSV.

### Task 5: `website`, `phone_number`

**Files:** `backend/app/question_types/text.py` (+ `phonenumbers` in `backend/requirements.txt`), `backend/tests/test_types_contact.py`,
`frontend/components/respondent/answers/{WebsiteAnswer,PhoneAnswer}.tsx`, `frontend/components/builder/settings/PhoneSettings.tsx`

**Interfaces:**
- `website` properties `{}`; validate: trimmed, scheme optional (`example.com` accepted), only `http`/`https`, host with a dot; stores the
  trimmed text; error "Hmm… that web address doesn’t look right. Check for any typos or errors."
- `phone_number` properties `{default_country: str = "US"}` (ISO alpha-2); value stored as E.164 (`+14155550123`); validate with
  `phonenumbers.is_valid_number`; error "Hmm... that phone number doesn't look right". Respondent: flag + dial-code select
  (`country-flag-icons`) and national-number input, formatted live with `libphonenumber-js`; settings: "Required" and a default-country
  select (flag + country name), like Typeform.

- [ ] **Step 1: Write tests:** `test_website_accepts_bare_domain`, `test_website_rejects_javascript_scheme`,
  `test_phone_normalizes_to_e164` (`"(415) 555-0123"` with default US → `+14155550123`), `test_phone_rejects_short_number`,
  `test_phone_required_empty_is_required_message`.
- [ ] **Step 2: Run, see FAIL; implement; run, see PASS.**
- [ ] **Step 3: Frontend** components and settings; `npm run typecheck && npm run lint`.
- [ ] **Step 4: Browser check** (see section intro); the website answer in Results is plain text, never an `href`.

### Task 6: `date`

**Files:** `backend/app/question_types/date.py`, `backend/tests/test_types_date.py`, `frontend/components/respondent/answers/DateAnswer.tsx`,
`frontend/components/builder/settings/DateSettings.tsx`

**Interfaces:**
- properties `{format: "MMDDYYYY"|"DDMMYYYY"|"YYYYMMDD" = "MMDDYYYY", separator: "/"|"-"|"." = "/", start_date: str|None, end_date: str|None}`
  (ISO dates); value stored as `"YYYY-MM-DD"`; messages as in Global Constraints; summary = text-style list of answers.
  Respondent: three inputs (Month / Day / Year, order by `format`), numeric keyboard, auto-advance between parts; settings: Required,
  Date format select + separator select, Start date, End date switches with date pickers (like Typeform's panel).

- [ ] **Step 1: Write tests:** `test_date_accepts_leap_day`, `test_date_rejects_feb_30` ("That date doesn't look valid—it's incomplete or
  doesn't exist"), `test_date_before_start_uses_on_or_after_message`, `test_date_range_message_when_both_limits`,
  `test_end_before_start_rejected_by_properties_model`.
- [ ] **Step 2–4:** red, implement backend, green; frontend; browser check (type `02/29/2028`, `13/01/2026`).

### Task 7: `legal`, `checkbox`, `opinion_scale`, `nps`

**Files:** `backend/app/question_types/{choice,numeric}.py`, `backend/tests/test_types_scales.py`,
`frontend/components/respondent/answers/{LegalAnswer,CheckboxAnswer,OpinionScaleAnswer,NpsAnswer}.tsx`,
`frontend/components/builder/settings/{OpinionScaleSettings,NpsSettings}.tsx`, summary components

**Interfaces:**
- `legal` `{}` and `checkbox` `{label: str = ""}`: value `bool`; required legal must be `true` ("Please agree to the terms & conditions");
  respondent legal shows "I accept" / "I don’t accept" buttons; checkbox shows one checkbox. Summary: accepted / declined counts.
  (Read Typeform's Checkbox article before building the panel.)
- `opinion_scale` `{steps: int 5..11 = 10, start_at_one: bool = True, labels: {left, center, right}}`; value int; summary like rating.
- `nps` `{labels: {left: "Not at all likely", center: "", right: "Extremely likely"}}`; value int 0..10; summary adds NPS =
  %promoters (9–10) − %detractors (0–6) with the three groups, plus the 0–10 distribution.

- [ ] **Step 1: Tests:** `test_legal_required_rejects_false`, `test_opinion_scale_range_follows_start_and_steps`,
  `test_nps_summary_score` (answers 10,9,8,3 → promoters 50%, detractors 25%, NPS 25), `test_nps_rejects_11`.
- [ ] **Step 2–4:** red, implement, green; frontend; browser check including keyboard (number keys choose a step).

### Task 8: `statement`

**Files:** `backend/app/question_types/structure.py`, `backend/tests/test_types_structure.py`,
`frontend/components/respondent/StatementScreen.tsx`

**Interfaces:**
- `statement` properties `{button_text: str = "Continue"}`, `answerable=False`: never in answers, results, CSV or summary; the respondent
  screen shows title, description and a Continue button (Enter works); in logic it can't be a condition source but can be a jump target.

- [ ] **Step 1: Tests:** `test_statement_never_stored` (submission containing a statement id is rejected as unknown answer),
  `test_statement_not_in_summary_or_csv`, `test_statement_can_be_jump_target`.
- [ ] **Step 2–4:** red, implement, green; frontend; browser check (Continue and Enter).

---

## Phase 1C: composite answer types

### Task 9: `contact_info`, `address`

**Files:** `backend/app/question_types/composite.py`, `backend/tests/test_types_composite.py`,
`frontend/components/respondent/answers/{ContactInfoAnswer,AddressAnswer}.tsx`, `frontend/components/builder/settings/FieldListSettings.tsx`

**Interfaces:**
- properties `{fields: [{key, label, enabled, required}]}`; `contact_info` keys `first_name, last_name, phone_number, email, company`;
  `address` keys `address, address2, city, state, zip, country`; value is an object keyed by `key` (only enabled, non-empty fields).
  Per-field rules: email and phone use the same validators as the standalone types; a required field left empty is reported as
  `"<key>": "Please fill this in"` inside the question's error. Settings panel: a field list with enable switch, label edit and
  Required switch per field (like Typeform's "add, remove, reorder and customize fields").

- [ ] **Step 1: Tests:** `test_contact_info_requires_only_flagged_fields`, `test_contact_info_rejects_bad_email_inside`,
  `test_address_drops_empty_optional_fields`, `test_composite_summary_lists_answers`, `test_removed_field_ignored_in_csv`.
- [ ] **Step 2–4:** red, implement, green; frontend (Tab moves between sub-fields, Enter on the last field submits); browser check.

### Task 10: `ranking`, `matrix`

**Files:** `backend/app/question_types/choice.py` (ranking) and `composite.py` (matrix), `backend/tests/test_types_ranking_matrix.py`,
`frontend/components/respondent/answers/{RankingAnswer,MatrixAnswer}.tsx`, `frontend/components/builder/settings/{RankingSettings,MatrixSettings}.tsx`,
`frontend/components/builder/canvas/CanvasList.tsx` (inline editing of options / rows / columns, shared with `CanvasChoices`)

**Interfaces:**
- `ranking` `{options: [{id,label}], randomize: bool = False}`; value = list of option ids in rank order; valid only if it is a permutation
  of the current options (partial rankings rejected when required, dropped when optional-and-empty). Respondent: a number select per
  option (Typeform's dropdown ranking) with drag handles as an extra; summary: average rank per option.
- `matrix` `{rows: [{id,label}], columns: [{id,label}], allow_multiple: bool = False}`; value `{row_id: column_id | [column_ids]}`; required
  means every row answered; summary: counts per row × column table. Stale ids render as "(removed row)" / "(removed choice)".

- [ ] **Step 1: Tests:** `test_ranking_requires_permutation`, `test_ranking_summary_average_rank`, `test_matrix_requires_all_rows_when_required`,
  `test_matrix_single_vs_multiple`, `test_matrix_removed_column_shows_placeholder_in_csv` (Review Focus 2).
- [ ] **Step 2–4:** red, implement, green; frontend; browser check.

---

## Phase 1D: structure

### Task 11: question groups

**Files:** `backend/app/services/groups.py`, `backend/app/question_types/structure.py` (group spec), `backend/tests/test_groups.py`,
`frontend/components/builder/QuestionList.tsx`, `frontend/components/builder/GroupSettings.tsx`,
`frontend/components/respondent/RespondentFlow.tsx` (header above grouped questions)

**Interfaces:**
- `group` properties `{button_text: str = "Continue"}`, `answerable=False`; `Question.group_id` points at the header row. Service functions:
  `add_to_group(db, question, group) -> Question` (moves the question to sit after the group's last child), `remove_from_group(db, question) -> Question`
  (moves it right after the group), `delete_group(db, group)` (deletes header and children); `PATCH /questions/{id}` accepts `group_id: int | None`.
  Respondent API returns `group_title` on each child; a header with no children is skipped; a jump aimed at a header lands on its first child.
- Builder: group header row with a collapse arrow, children indented; dragging a child above the header or below the last child removes it
  from the group; deleting a header asks "delete N questions too?"

- [ ] **Step 1: Tests:** `test_delete_group_removes_children`, `test_child_moved_out_leaves_group`, `test_empty_group_skipped_by_path`,
  `test_jump_to_group_lands_on_first_child`, `test_group_not_in_results_or_csv`.
- [ ] **Step 2–4:** red, implement, green; frontend; browser check (add group, add two questions, drag one out, delete the header).

### Task 12: welcome-screen options and multiple endings

**Files:** `backend/app/routers/endings.py`, `backend/app/services/endings.py`, `backend/app/schemas/{ending,form}.py`, `backend/tests/test_endings.py`,
`frontend/components/builder/{EndingsCard,WelcomeSettings,EndingSettings}.tsx`, `frontend/components/respondent/{WelcomeScreen,ThankYouScreen}.tsx`

**Interfaces:**
- API: `GET/POST /forms/{id}/endings`, `PATCH/DELETE /endings/{id}`, `PUT /forms/{id}/endings/order`; `FormOut.endings: list[EndingOut]`
  (keeps `thank_you` = the first ending for old clients); a form always keeps at least one ending; duplicate copies the endings.
  `PATCH /forms/{id}` accepts `welcome: {button_text (max 24), show_time_to_complete, show_submission_count}`; the public form returns them
  and `submission_count`; "Takes X minutes" is computed from `average_seconds` rounded up (shows "Takes X minutes" until there is data).
- Builder: Endings card with an active "+" (new ending), per-ending row with ⋮ Duplicate/Delete; welcome right panel with the two switches
  and a Button field with a counter `n/24`, exactly as in Typeform. Until logic v2 (Phase 3) the respondent always sees the first ending.

- [ ] **Step 1: Tests:** `test_first_ending_created_with_form`, `test_cannot_delete_last_ending`, `test_duplicate_form_copies_endings`,
  `test_welcome_button_text_limit_24`, `test_public_form_includes_submission_count_only_when_enabled`.
- [ ] **Step 2–4:** red, implement, green; frontend; browser check.

### Task 13: change a question's type

**Files:** `backend/app/services/questions.py`, `backend/tests/test_change_type.py`, `frontend/components/builder/settings/AnswerTypeSelect.tsx`

**Interfaces:**
- `PATCH /questions/{id}` accepts `type`; allowed among answerable types (not into or out of `group`/`statement`); properties are converted by
  `spec.convert(from_type, from_props)` where defined (choice ↔ choice keeps options, text ↔ text keeps placeholder, rating-like ↔ rating-like keeps
  steps) else reset to defaults; existing answers are deleted (the builder confirms: "Changing the type removes N answers"); logic rules are kept
  only if their ops still apply, otherwise removed.

- [ ] **Step 1: Tests:** `test_change_choice_to_dropdown_keeps_options`, `test_change_type_deletes_answers`, `test_change_type_drops_incompatible_rules`,
  `test_cannot_change_into_group`.
- [ ] **Step 2–4:** red, implement, green; frontend Answer select (Typeform's dropdown with chips); browser check.

---

## Phase 1E: parity polish and results

### Task 14: settings parity for the existing types

**Files:** `backend/app/schemas/properties.py` (or the type modules from Task 3), `backend/tests/test_types_existing.py`,
`frontend/components/builder/settings/{ChoiceSettings,RatingSettings,TextSettings,NumberSettings}.tsx`

**Interfaces:**
- `multiple_choice` gains `none_of_the_above: bool`, `randomize: bool`, `min_selections: int|None`, `max_selections: int|None`
  (only with `allow_multiple`; `min <= max <= options`), and the respondent hint from the system messages ("Choose as many as you like",
  "You can choose up to {max}", "Choose at least {min}", "Make between {min} and {max} choices"); `allow_other` already exists.
- `dropdown` gains `alphabetical: bool`, `randomize: bool` (display order only; stored ids unchanged).
- `rating` shape widens to Typeform's list (`star, heart, crown, cat, dog, droplet, flag, lightbulb, pencil, skull, thunderbolt, tick,
  trophy, up, user, circle, cloud`) and steps stay 3–10 on the existing field, `number` stays as a shape.
- `short_text` / `long_text` keep `placeholder` and `max_length` (Typeform shows both as "Custom placeholder text" and "Max characters" switches).

- [ ] **Step 1: Tests:** `test_min_selections_enforced`, `test_max_selections_enforced`, `test_none_of_the_above_is_exclusive`,
  `test_randomize_keeps_ids`, `test_rating_accepts_new_shapes`, `test_old_properties_still_load` (properties saved before this task validate).
- [ ] **Step 2–4:** red, implement, green; frontend switch rows in the same order as Typeform's panel; browser check.

### Task 15: Add content catalog and Pages list as Typeform's

**Files:** `frontend/components/builder/AddContentModal.tsx`, `frontend/components/builder/QuestionList.tsx`, `frontend/components/builder/EndingsCard.tsx`

**Interfaces:**
- Add content groups in Typeform's order and wording: Contact info, Choice, Rating & ranking, Text & Video, Other, Form structure (Welcome Screen,
  Partial Submit Point [Soon], Statement, Question Group, End Screen, Redirect to URL [Soon]); left rail "Recommended" and "Connect to apps"
  (HubSpot, Salesforce [Soon], Browse all apps [Soon]); search filters all groups; every free item is enabled, every paid item disabled with a
  "Soon" badge. Pages list rows become white cards (12px radius, tag chip with icon + number, title), the form-mode selector shows "Universal mode"
  (disabled), the divider between Pages and Endings is draggable like Typeform's.

- [ ] **Step 1: Capture Typeform at 1440×900 (Add content dialog, Pages list) and compare ours at the same size; fix differences.**
- [ ] **Step 2: Verify:** every free type adds a question (browser check loops over the catalog), every Soon item is inert.

### Task 16: results, CSV and drawer for the new types; docs; side-by-side sweep

**Files:** `frontend/components/results/*`, `frontend/lib/answerFormat.ts`, `backend/app/services/export.py`, `docs/{API_SPEC,DATABASE_SCHEMA,PROGRESS,HANDOFF}.md`, `README.md`

- [ ] **Step 1: Test:** `test_csv_has_one_column_per_answerable_question_and_none_for_groups_or_statements` and a browser check that summary,
  table and drawer show every new type (including stale ids).
- [ ] **Step 2: Docs:** API_SPEC (endpoints, types, value formats), DATABASE_SCHEMA (new columns/table/migration chain), PROGRESS (phase log),
  HANDOFF (state and next phase), README (feature list, test count).
- [ ] **Step 3: Phase checkpoint:** `npm run test:backend`, `npm run typecheck`, `npm run lint` pass; full browser run on 3100/8100;
  side-by-side screenshots of workspace, builder (each type), Add content, respondent (each type) against Typeform; the owner checks localhost:3000.
