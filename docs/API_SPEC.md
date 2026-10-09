# API Spec — base `/api`

Errors: `{ "detail": "msg" }` (400/404/500) or `{ "detail": { "errors": { "<key>": "msg" } } }` (422). For request bodies `<key>` is the field path (`title`, `theme.background`, `properties.max`; `body` for whole-body rules); for public submissions it is the question id.
Timestamps are ISO-8601 UTC (`...Z`). Create endpoints return 201, deletes 204.

## Forms (creator)
| Method | Path | Notes |
|---|---|---|
| GET | `/forms` | list (most recently updated first): id, title, status, slug, response_count (completed only), response_total (all, partial included), question_count, theme (for the workspace preview), created_at, updated_at, published_at |
| POST | `/forms` | create `{title?}` (body optional) → form with 0 questions, default theme/thank_you |
| GET | `/forms/{id}` | form + ordered questions + response_count. All form-returning endpoints use this shape |
| PATCH | `/forms/{id}` | `{title?, description?, theme?, thank_you?}`; omitted = unchanged; only `description` may be null; theme/thank_you replaced whole |
| DELETE | `/forms/{id}` | cascade |
| POST | `/forms/{id}/duplicate` | copies form + questions (not responses), title "X (copy)", status draft, new slug |
| POST | `/forms/{id}/publish` | status=published; 400 if no questions |
| POST | `/forms/{id}/unpublish` | status=draft |

## Questions
| Method | Path | Notes |
|---|---|---|
| POST | `/forms/{id}/questions` | `{type, title?, description?, required?, properties?, position?}` appended at end (or inserted at `position`, clamped); omitted `properties` → type defaults |
| PATCH | `/questions/{qid}` | partial update (title, description, required, properties, logic); `type` is immutable; properties validated against type; `logic` validated per type (see Branching) and replaced whole (null or no rules → null) |
| DELETE | `/questions/{qid}` | renumber positions; other questions' jumps to it are removed |
| PUT | `/forms/{id}/questions/order` | `{ordered_ids:[...]}` single transaction; must list every question exactly once (else 400); returns ordered questions |

## Public (no auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/public/forms/{slug}` | only if published (else 404); returns slug, title, description, theme, thank_you, ordered questions `{id,type,title,description,required,properties,logic}` (no form id / position) |
| POST | `/public/forms/{slug}/responses` | `{answers:{ "<qid>": value }}` → validates the respondent's path (unknown ids rejected, empty optional answers and answers to skipped questions dropped) → 201 `{id}`; 422 `{detail:{errors:{"<qid>": msg}}}` |
| POST | `/public/forms/{slug}/responses/start` | bonus: creates an empty `partial` response → 201 `{response_id, token}`; 404 unless published |
| PATCH | `/public/responses/{rid}` | bonus: `{token, answers, complete?}` replaces the stored answers (each validated, required not enforced, off-path dropped); `complete: true` validates like a full submission and marks it completed → 200 `{id, status}`. 404 for a wrong token / unknown id / unpublished form; 409 once completed |

## Results (creator)
| Method | Path | Notes |
|---|---|---|
| GET | `/forms/{id}/responses?page&page_size&status` | `{items, total, page, page_size}`; page ≥1, page_size 1–100 (default 20), status `completed` or `partial`; newest first (submitted_at, else started_at); item `{id, status, started_at, submitted_at, answers:{"<qid>": value}}` (unanswered absent) |
| GET | `/forms/{id}/responses/{rid}` | `{id, status, started_at, submitted_at, answers:[{question_id, question_title, question_type, value}]}` in question order; 404 if the response belongs to another form |
| DELETE | `/forms/{id}/responses/{rid}` | 204 |
| GET | `/forms/{id}/summary` | per-question stats (completed responses only) + totals + completion rate (0 when no responses) |
| GET | `/forms/{id}/responses/export.csv` | bonus: UTF-8 with BOM, attachment `<title>-responses.csv`; one row per response (all statuses), answers human-readable (choice labels joined with `; `, `Yes`/`No`, rating `4/5`); cells starting with `= + - @` are prefixed with `'` |

## Branching (`questions.logic`)
`{"rules": [{"op", "value", "to"}]}` — checked in order after the question is answered; the first matching rule decides where to go (`to`: a question id of the same form, or `"end"`), otherwise the next question. Max 20 rules.

| Question type | ops | value |
|---|---|---|
| multiple_choice, dropdown | `is`, `is_not` (multi-select: includes / doesn't include) | option id |
| yes_no | `is` | `true` / `false` |
| number, rating | `eq`, `neq`, `lt`, `lte`, `gt`, `gte` | number |
| short_text, long_text, email | `is`, `is_not`, `contains` (trimmed, case-insensitive) | non-empty text (≤ 500) |

422 keys: `logic.rules.<i>.op|value|to`. Unanswered questions match no rule. Only **forward** jumps are followed: a target that is missing or not after the question (e.g. after a reorder) is skipped, so paths can't loop. `services/logic.py` and `frontend/lib/logic.ts` implement the same resolver; submissions are validated along the resulting path.

## Validation rules (server authoritative)
- required → non-empty · email → RFC-lite regex · number → numeric, within min/max · rating → int 1..max · yes_no → bool · choice/dropdown → option id(s) must exist · text → max_length · unknown question ids rejected.

## Summary shape
```json
{ "total_responses": 12, "completed": 10, "completion_rate": 0.8333,
  "questions": [
   {"question_id":1,"type":"multiple_choice","title":"…","answered":10,"counts":[{"option_id":"a","label":"Yes","count":6}]},
   {"question_id":2,"type":"rating","title":"…","answered":10,"max":5,"average":4.2,"distribution":{"1":0,"2":1,"3":1,"4":3,"5":5}},
   {"question_id":3,"type":"number","title":"…","answered":8,"min":1,"max":40,"average":12.5},
   {"question_id":4,"type":"short_text","title":"…","answered":9,"recent":["…"]}
  ]}
```
- `counts` (multiple_choice, dropdown, yes_no — yes/no use option ids `yes`/`no`) are in option order; multi-select counts can sum past `answered`; answers naming since-removed options are not counted.
- `recent` (short_text, long_text, email): latest 5, most recent first. `average` is rounded to 2 decimals; `null` (and `min`/`max` null) when nothing was answered.

## Typeform AI chat (`/api/ai`)

Gemini runs on the server (`GEMINI_API_KEY`, `GEMINI_MODEL` in `backend/.env`); the browser never sees the key. `POST /ai/forms` and
`POST /ai/forms/{id}/questions` (one-shot generation) still exist. The chat never saves anything: only `/ai/apply` does.

- `POST /ai/chat` `{form_id: int|null, messages: [{role: "user"|"assistant", content}], draft?: Proposal|null, memory?: string|null}` →
  `{reply, proposal: Proposal|null, diff: Diff|null}`. `form_id: null` drafts a form that doesn't exist yet. `draft` is the proposal the
  creator is reviewing (the next turn builds on it); the diff is always against the *saved* form. The last message must be the creator's
  (422 otherwise). Errors: 404 unknown form, 503 no key, 502 Gemini failure (friendly message). `proposal` is null when the turn only
  answered a question, declined a request (design, scoring, logic are "not supported yet") or changed nothing.
- `POST /ai/apply` `{form_id: int|null, proposal}` → the saved form (`FormOut`). One transaction: invalid proposals (ids from another form,
  type changes, bad properties, a group removed while its questions stay) return 422 keyed like `questions.3.properties.max` and change
  nothing; `form_id: null` creates a draft form. Removed questions delete their answers and the jumps that pointed at them.
- `GET/PUT /ai/memory` `{content}` (≤ 2000 characters; one row, the app has no accounts) → `{content, max_length}`.

`Proposal` = `{welcome: {title, description, button_text, show_time_to_complete, show_submission_count}, questions: [{id|null, type, title,
description, required, properties, group_id}], endings: [{id|null, title, message, button_text, button_url}]}`: the whole form after the
change; `id: null` = new. `Diff` = `{to_remove: [..], to_set: [{.., change: "new"|"changed"|"moved", fields, moved}], endings: {to_remove, to_set}, welcome: [field names]}`.
The model works on a flat view (options as labels, `rating_max`/`rating_shape`); the server keeps every stored property of unchanged questions
and the ids of surviving choice labels, validates everything like a manual edit, and drops what it can't (with a note in `reply`).
