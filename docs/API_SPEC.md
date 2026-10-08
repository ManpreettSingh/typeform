# API Spec — base `/api`

Errors: `{ "detail": "msg" }` (400/404/500) or `{ "detail": { "errors": { "<key>": "msg" } } }` (422). For request bodies `<key>` is the field path (`title`, `theme.background`, `properties.max`; `body` for whole-body rules); for public submissions it is the question id.
Timestamps are ISO-8601 UTC (`...Z`). Create endpoints return 201, deletes 204.

## Forms (creator)
| Method | Path | Notes |
|---|---|---|
| GET | `/forms` | list (most recently updated first): id, title, status, slug, response_count (completed only), question_count, created_at, updated_at, published_at |
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
| PATCH | `/questions/{qid}` | partial update (title, description, required, properties); `type` is immutable; properties validated against type |
| DELETE | `/questions/{qid}` | renumber positions |
| PUT | `/forms/{id}/questions/order` | `{ordered_ids:[...]}` single transaction; must list every question exactly once (else 400); returns ordered questions |

## Public (no auth)
| Method | Path | Notes |
|---|---|---|
| GET | `/public/forms/{slug}` | only if published (else 404); returns slug, title, description, theme, thank_you, ordered questions `{id,type,title,description,required,properties}` (no internal fields) |
| POST | `/public/forms/{slug}/responses` | `{answers:{ "<qid>": value }}` → validates all (unknown ids rejected, empty optional answers dropped) → 201 `{id}`; 422 `{detail:{errors:{"<qid>": msg}}}` |
| POST | `/public/forms/{slug}/responses/start` | bonus: create partial, returns `{response_id}` |
| PATCH | `/public/responses/{rid}` | bonus: upsert partial answers; `{answers, complete?}` |

## Results (creator)
| Method | Path | Notes |
|---|---|---|
| GET | `/forms/{id}/responses?page&page_size&status` | `{items, total, page, page_size}`; page ≥1, page_size 1–100 (default 20), status `completed` or `partial`; newest first (submitted_at, else started_at); item `{id, status, started_at, submitted_at, answers:{"<qid>": value}}` (unanswered absent) |
| GET | `/forms/{id}/responses/{rid}` | `{id, status, started_at, submitted_at, answers:[{question_id, question_title, question_type, value}]}` in question order; 404 if the response belongs to another form |
| DELETE | `/forms/{id}/responses/{rid}` | 204 |
| GET | `/forms/{id}/summary` | per-question stats (completed responses only) + totals + completion rate (0 when no responses) |
| GET | `/forms/{id}/responses/export.csv` | bonus: UTF-8 with BOM, attachment `<title>-responses.csv`; one row per response (all statuses), answers human-readable (choice labels joined with `; `, `Yes`/`No`, rating `4/5`); cells starting with `= + - @` are prefixed with `'` |

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
