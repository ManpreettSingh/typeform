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
| GET | `/forms/{id}/responses?page&page_size&status` | rows with answers keyed by question |
| GET | `/forms/{id}/responses/{rid}` | full response with question titles |
| DELETE | `/forms/{id}/responses/{rid}` | optional |
| GET | `/forms/{id}/summary` | per-question stats + totals + completion rate |
| GET | `/forms/{id}/responses/export.csv` | bonus |

## Validation rules (server authoritative)
- required → non-empty · email → RFC-lite regex · number → numeric, within min/max · rating → int 1..max · yes_no → bool · choice/dropdown → option id(s) must exist · text → max_length · unknown question ids rejected.

## Summary shape
```json
{ "total_responses": 12, "completed": 10, "completion_rate": 0.83,
  "questions": [
   {"question_id":1,"type":"multiple_choice","answered":10,"counts":[{"option_id":"a","label":"Yes","count":6}]},
   {"question_id":2,"type":"rating","answered":10,"average":4.2,"distribution":{"1":0,"2":1,"3":1,"4":3,"5":5}},
   {"question_id":3,"type":"short_text","answered":9,"recent":["..."]}
  ]}
```
