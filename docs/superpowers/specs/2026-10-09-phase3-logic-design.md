# Phase 3: logic and workflow (design)

Date: 2026-10-09 · Status: **draft for review** · Refines D4 of `2026-10-09-typeform-parity-design.md` and the "Phase 3" entry
of its §5. Measurements of Typeform's Workflow tab (Free plan, 2026-10-09) are in `docs/design/typeform-live-reference.md`
(last section); this spec only repeats them where a decision depends on them.

## 1. Goal and success criteria

A form creator can steer respondents with rules exactly as on Typeform's free plan, and respondents experience the result:
questions are hidden or shown, answer choices are hidden, the next question or ending is chosen from answers, scores and
variables, URL parameters and earlier answers are recalled in text, and each response records its score, variables, URL
parameters and ending.

Done means (the program's definition, §1 of the parent spec, applied here):
1. The Logic, Score quiz, Outcome quiz, Variables and Pull-data-in dialogs and the Workflow tab match Typeform side by side at
   1440×900 (light mode), motion included.
2. For every feature below, **three respondent paths** are exercised end to end on the isolated stack (3100/8100) and the
   resulting rows (`answers`, `responses.variables`, `responses.params`, `responses.ending_id`) are asserted in the database.
3. `npm run test:backend` and `npm run check:frontend` pass; the Python and TypeScript resolvers pass the **same golden
   fixtures** (see §4.5).

## 1a. Fast-path scope (decided with the owner, 2026-10-09)

The owner asked to finish quickly and to defer unimportant parts. **Built now (3A + 3B):** v2 branch rules with and/or and
"all other cases", jump to question / ending / Default end, calculations, variables, Score quiz, Outcome quiz, URL parameters,
recall, results columns, the Logic / Variables / Pull data in / Score quiz / Outcome quiz dialogs. **Deferred (listed in
`docs/superpowers/DEFERRED.md`):** the `hide` and `hide_choices` rule lists and their dialog sections (§3.1, §4.1 steps 3a-3b,
§5 "Hide"), and the logic-map canvas (§7, 3C). Everything else in this spec applies; where a section mentions the deferred
items, skip them. `logic` v2 gets the deferred keys later without a migration (additive).

## 2. What changes against the approved D4

| D4 (parent spec) | This design (from the measurements) |
|---|---|
| One rule = conditions + actions | Four per-question rule lists: **hide question**, **hide answer choices**, **branching** (with an "all other cases" target), **calculations** |
| Actions: set / add / subtract / multiply | **add / subtract / multiply / divide** on a numeric variable; there is no "set" |
| `score` and `price` built in | `score` is real; `price` and `segment` are listed **disabled** (Typeform: "Requires a Payment question") |
| Scoring quiz writes `score` | Same, and the Scoring dialog is a **view over calculation rules** of one exact shape (§6) |
| Outcome quiz maps answers to endings | Same: each picked answer adds one point to its ending; highest wins (§6) |
| URL parameters (names) | 12 predefined toggles (5 UTM, 7 respondent) plus custom names; read from the query string and the hash |
| Recall `{{field}} {{var}} {{param}}` | Same tokens; `@` picker lists earlier questions, variables and URL parameters |
| Jump target: question or ending | Question, a specific **ending**, or **Default end** (a built-in plain screen) |

Out of scope (shown disabled with "Soon" where Typeform shows them): Tagging, the loop icon, Quiz variables, Data enrichment
variables, `price`, `segment`, Contacts, Automations. Rich-text formatting of questions stays a Phase 4 suggestion.

## 3. Data model

### 3.1 `questions.logic` version 2

```jsonc
{
  "version": 2,
  "hide":         [ { "when": Condition-set } ],                       // question display: hide this question
  "hide_choices": [ { "choices": ["<choice id>", ...], "when": ... } ],// answer choices to remove
  "branch":       { "rules": [ { "to": Target, "when": ... } ],        // first matching rule wins
                    "otherwise": Target | null },                     // "all other cases go to"; null = next question
  "calc":         [ { "op": "add|subtract|multiply|divide",
                      "value": { "number": 5 } | { "variable": "score" },
                      "variable": "score",                            // numeric variable to change
                      "when": ... } ]                                 // all matching rules run, in order
}
```

* **Condition-set** `when` = `{ "match": "all" | "any", "conditions": [Condition, ...] }` (1–10 conditions; the dialog's
  `and ▾` / `or` dropdown sets `match` for the whole rule). An empty `when` is invalid, except `branch.otherwise`, which has
  none.
* **Condition** = `{ "source": Source, "op": "...", "value": ... }`.
  * `Source` = `{ "question": <id> }` | `{ "variable": "<name>" }` | `{ "param": "<name>" }`.
  * For a question source, `op` and `value` come from the question type's registry (`logic_ops`, `logic_match`,
    `logic_value_error`), exactly as v1 rules do.
  * For a number variable: `eq neq lt lte gt gte` with a number. For a text variable or a URL parameter: `is is_not
    contains` with text (≤ 500 characters). A URL parameter that is absent never matches.
* **Target** = `{ "question": <id> }` | `{ "ending": <ending id> }` | `{ "end": true }` (Default end).
* **Allowed sources by list:** `branch` and `calc` rules may read the current and earlier questions; `hide` and `hide_choices`
  rules may read **earlier** questions only (the question has no answer yet); all lists may read variables and URL parameters.
  "Earlier" is by `position`, not by path.
* Limits: 10 `hide`, 10 `hide_choices`, 20 `branch.rules`, 20 `calc` rules per question; stored `logic` is `null` when all
  lists are empty.

### 3.2 Form and response columns

| Table.column | Type | Meaning |
|---|---|---|
| `forms.variables` | JSON, default `[]` | `[{ "name": "score", "type": "number", "initial": 0 }, ...]`; `score` always present; ≤ 20 custom |
| `forms.url_parameters` | JSON, default `[]` | enabled names, predefined or custom; ≤ 30; a custom name matches `^[A-Za-z][A-Za-z0-9_]{0,39}$` |
| `endings.outcome` | JSON, default `[]` | `[{ "question": <id>, "choice": "<choice id>" }, ...]`: each adds one point to this ending |
| `responses.variables` | JSON, nullable | final values, set when the response completes |
| `responses.params` | JSON, nullable | declared URL parameters received (≤ 500 chars each, plain text) |
| `responses.ending_id` | int FK → `endings.id` ON DELETE SET NULL | the ending the respondent reached; `NULL` on a completed response = Default end |

Variable names: `^[a-z][a-z0-9_]{0,39}$`, unique, never `price` or `segment`. Text variables hold only their starting value (no
calculation can change them, as on Typeform); they exist for conditions and recall.

### 3.3 Migrations (appended to `MIGRATIONS`, each idempotent with a test from the previous schema)

1. `add_forms_variables_and_params`
2. `add_endings_outcome`
3. `add_responses_outcome` (`variables`, `params`, `ending_id`)
4. `convert_logic_v1_to_v2`: a v1 rule `{op, value, to}` on question *Q* becomes a branch rule with one condition on *Q*;
   `to: "end"` becomes `{ "ending": <first ending id> }` (v1 showed the first ending, so behavior is unchanged); a form with
   no endings gets `{ "end": true }`. Questions already at `version: 2` are skipped.

## 4. Engine

### 4.1 Resolver (the one definition both languages implement)

`resolve(form, answers, params) → { path, variables, ending, hidden_choices }`

1. `variables` starts from each variable's `initial`.
2. Visit questions in `position` order starting at the first. Group header rows follow the existing rules (a header is shown
   only if at least one of its children is visible).
3. For question *q*:
   a. **Hide choices.** Remove the choices named by every matching `hide_choices` rule. The result is `hidden_choices[q]`.
   b. **Hide.** If any `hide` rule matches, or *q* has choices and none remain after step a, *q* is skipped: not shown, no
      answer kept, its calculations and branching do not run. Continue with the next question in order.
   c. *q* is on the `path`. Its (validated) answer is read from `answers`.
   d. **Calculations.** For each `calc` rule in order whose `when` matches (conditions see answers so far, the current
      answer and the variables as updated by earlier rules): apply `variable = variable ⊕ value`. Divide by zero leaves the
      variable unchanged. An unanswered question never satisfies a condition on itself.
   e. **Branching.** The first `branch.rules` entry whose `when` matches decides; otherwise `branch.otherwise`; otherwise the
      next question. A `{question}` target that is not after *q* is ignored; a target that is hidden lands on the next visible
      question; a target on a group header lands on its first visible child. An `{ending}` or `{end}` target finishes the form.
4. After the last question (or a finishing target) the **ending** is chosen: (1) the finishing target, if one ended the form;
   (2) otherwise the outcome quiz winner (§6.2); (3) otherwise the first ending. `ending` is `{ "id": n }` or `{ "default": true }`.

Jumps stay forward-only, so every path is finite.

### 4.2 Server (authoritative)

`services/logic.py` holds the resolver; `services/validation.py` calls it (replacing the `next_index` loop) so that answers to
skipped questions are dropped, required checks apply only to visible questions, and an answer that selects a hidden choice is
rejected ("This option isn't available"). `services/submissions.py` stores `variables`, `params` and `ending_id` when a
response completes (submit or `complete: true`). Partial saves keep `params` and recompute nothing else.

### 4.3 Client mirror

`frontend/lib/logic.ts` implements the same `resolve` (replacing `nextIndex`, `visitedPath`, `canEndAfter`); the respondent
recomputes it whenever an answer changes (cheap). The final screen uses the **server's** `ending` and `variables`.

### 4.4 Reference integrity (one place: `services/logic_refs.py`)

A single function prunes v2 logic, endings' `outcome` and score rules when something they reference goes away, and is called
by every service that deletes or changes things. Removing a **question**, **ending**, **choice** (including by changing the
question type or editing choices), **variable** or **URL parameter**: rules that target it are removed; conditions that read
it are removed; a rule left with no conditions is **removed, never made unconditional**; `outcome` entries and score rules
that name it are removed. Duplicating a form remaps question, ending and choice references. Recall tokens are not touched:
a token that points at something removed renders as empty text, and stripping such tokens is deferred (§10).

### 4.5 Drift guard

`backend/tests/fixtures/logic_cases.json` holds golden cases `{form, answers, params, expected}` covering every rule list,
every kind of condition source, each tie-break and each edge case in §4.1 and §6. `tests/test_logic_golden.py` and `frontend/lib/logic.golden.test.ts` run the
same file; either implementation failing a case fails CI. Adding a feature means adding a case first.

## 5. Respondent behavior

* **URL parameters.** On load the client reads `location.search` and `location.hash` (`#a=1&b=2`), keeps only names the form
  declares, trims to 500 characters, and sends them with `start`, `progress` and `submit` (`params`). Values are plain text and
  always rendered as text, never HTML.
* **Recall.** `{{field:<id>}}`, `{{var:<name>}}`, `{{param:<name>}}` in question and welcome/ending titles and descriptions
  are replaced when rendering. A field answer uses the type's display formatter (choice → its label); an unanswered, hidden or
  unknown reference renders as empty text. Variables update live as calculations run.
* **Hide.** Hidden questions never appear, and the progress bar and "question n" numbers skip them. Hidden choices are not
  rendered and their keyboard letters are not assigned.
* **Ending.** After submit the screen shown is the server's `ending` (ending *n*, or the built-in Default end with the existing
  default thank-you text and no button). Preview in the builder runs the client resolver, so it shows the same ending.

## 6. Scoring and the outcome quiz

### 6.1 Scoring

The Score quiz dialog lists every choice-type question (multiple choice, dropdown, picture choice) with a "Score" number input
per choice. It reads and writes exactly the `calc` rules of this shape on that question, and no others:
`{ op: "add", value: {number: N}, variable: "score", when: {match: "all", conditions: [ {source: {question: Q}, op: "is",
value: <choice id>} ]} }`. Saving N = 0 or an empty input removes the rule. "Delete all rules" removes every such rule in the
form and leaves other calculations alone. With multiple selection each selected choice adds its points. N may be negative or
decimal (|N| ≤ 1,000,000).

### 6.2 Outcome quiz

The dialog shows one card per ending with a multi-select of answers (choice-type questions only), "+ Add Ending" (creates an
ending) and a trash per card that clears that ending's answers. Stored in `endings.outcome`. At the end of the form, each
ending's points = the number of its `outcome` entries whose question is on the path and whose choice was selected. The
**highest** wins; ties go to the **earliest ending** (lowest `position`); if every ending has 0 points the first ending is
used. An explicit finishing target (§4.1 step 4) always beats the quiz.

## 7. Builder (copying Typeform)

* **Workflow tab** toolbar: `Logic · Scoring · Tagging (Soon) · Outcome quiz | Preview · (x) Variables · loop (Soon) · settings`.
  Until 3C the body is the existing overview list (extended to show every rule list); 3C replaces it with the **logic map**.
* **Logic dialog**: the modal measured on Typeform (question list with "N rule set" badges, four collapsible sections, "Delete
  all rules", Cancel / Save, the "Unsaved changes" confirm). Opened from a node, from the overview, or from the **Logic** card in
  the Content tab's right panel (which replaces today's `LogicSettings` panel). Unsaved edits live in a local draft; **Save
  writes everything in one transaction** through `PUT /api/forms/{id}/logic`, which validates the proposed state as a whole.
* **Variables dialog**, **Pull data in dialog**, **Score quiz**, **Outcome quiz**: as measured, with Typeform's copy.
* **Recall**: typing `@` in a title or description opens "Recall information from…" with groups Questions, Variables, URL
  parameters; the token appears as a pill (storage stays plain text). `InlineText` is a `<textarea>` today and must become a
  small contenteditable to show pills; if caret or IME handling proves unstable the fallback is a plain-text token displayed
  in an overlay (decided in the plan, risk noted in §10).
* **Logic map (3C)**: nodes for welcome, each question and each ending, arrows with the dark branch button, "Pull data in" card
  on the left, an Actions rail on the right (Connect / Automations / Contacts shown "Soon"), zoom out / in / fit, a yellow
  warning on an ending no rule can reach, and a node click opens the Logic dialog.

## 8. API

* `PUT /api/forms/{id}/logic`: `{ questions: { "<id>": Logic | null }, endings: { "<id>": { outcome: [...] } }, variables?: [...],
  url_parameters?: [...] }`, all or nothing; errors are keyed like `questions.12.branch.rules.0.to`.
* `PATCH /api/questions/{id}` still accepts `logic` (v2); `PATCH /api/forms/{id}` accepts `variables` and `url_parameters`.
* Public: `PublicForm` gains `variables` and `url_parameters`; `SubmissionIn` and `PartialUpdateIn` gain `params`;
  `SubmissionOut` and `PartialUpdateOut` gain `ending` and `variables`.
* Results: the response list and detail include `variables`, `params`, `ending`; the CSV adds columns `Ending`, each variable
  and each declared URL parameter after the answers; the table adds the same columns; the detail panel shows them in a card.

## 9. Verification

* **Backend (pytest):** model validation (every limit, every bad shape), the four migrations (from `schema_v1.sql` and from a v1
  logic fixture), the golden cases, `logic_refs` (every removal kind, empty-rule removal, duplicate-form remap), submission
  paths storing variables/params/ending, the `PUT /logic` transaction (a bad rule leaves everything unchanged).
* **Frontend (node:test):** the same golden cases, recall rendering, URL parameter parsing (query and hash), score-rule
  mapping for the Scoring dialog.
* **Browser (Playwright/Edge on 3100/8100):** per feature three paths, with database assertions; fails on any request to
  `localhost:3000/8000`. A final side-by-side sweep against Typeform for each dialog and the map.
* **Typeform unknowns to measure first (read-only, in the scratch draft `DaXKht1o`, which the owner allowed):** the operator
  lists offered for variable and URL-parameter sources, the recall list once variables and parameters exist, the "Hide answer
  choices" rule row, whether a Typeform ending can be reached through "Default end" visibly. Where a measurement contradicts
  this spec, the spec is amended and the owner told.

## 10. Rulings made here, risks and deferred items

Rulings (flag any you disagree with): ties go to the earliest ending; zero points fall back to the first ending; a question
with all its choices hidden is skipped; an explicit ending target beats the outcome quiz; calculations run before branching on
the same question; hide rules read earlier questions only; a rule left with no conditions is removed rather than made
unconditional; text variables never change; `{ "end": true }` shows the built-in default thank-you; v1 `"end"` migrates to the
first ending.

Risks: the contenteditable recall editor (§7); the two resolvers drifting (mitigated by §4.5); the logic map canvas is the
largest UI piece and is last so it can be trimmed; Typeform may A/B test dialogs (measurements are dated 2026-10-09).

Deferred: stripping dangling recall tokens when a question is deleted; Tagging, loop icon, price/segment variables; rich-text
questions; Typeform AI editing of rules (Phase 5 will reuse the v2 models and `PUT /logic` validation).

## 11. Phasing (each ends with a checkpoint; the owner reviews on :3000)

* **3A**: models, migrations, `logic_refs`, resolver (both languages) with golden fixtures, validation and submissions,
  respondent (params, hide, hide choices, ending from server), Logic dialog (all four sections) with `PUT /logic`, Variables
  and Pull-data-in dialogs, recall, results columns.
* **3B**: Score quiz, Outcome quiz, ending routing and previews.
* **3C**: the logic map, docs, side-by-side sweep, final self-review.
