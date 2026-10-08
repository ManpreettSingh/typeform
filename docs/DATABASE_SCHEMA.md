# Database Schema (SQLite)

```
forms 1 ──< questions
forms 1 ──< responses 1 ──< answers >── 1 questions
```

## forms
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| slug | TEXT UNIQUE NOT NULL | public URL id, e.g. `k3Jd9xQ` |
| title | TEXT NOT NULL | default "Untitled form" |
| description | TEXT NULL | welcome-screen subtitle (optional) |
| status | TEXT NOT NULL | `draft` \| `published` (CHECK) |
| theme | JSON | `{background, text_color, button_color, font}` (hex colors) |
| thank_you | JSON | `{title, message, button_text?, button_url?}` |
| created_at / updated_at / published_at | DATETIME | |

## questions
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| form_id | FK → forms.id ON DELETE CASCADE | indexed via UNIQUE(form_id, position) |
| type | TEXT NOT NULL | `short_text, long_text, multiple_choice, dropdown, email, number, yes_no, rating` (CHECK) |
| title | TEXT NOT NULL | the question |
| description | TEXT NULL | help text |
| required | BOOLEAN default 0 | |
| position | INTEGER NOT NULL | 0-based, contiguous; UNIQUE(form_id, position). SQLite can't defer UNIQUE, so renumbering moves rows to a free range above max(position) then to final slots, in one transaction |
| properties | JSON | per-type config (below) |
| logic | JSON NULL | bonus: branching rules `{"rules":[{"op","value","to": <question id> \| "end"}]}` (API_SPEC.md "Branching"); null = always the next question. Jump targets are remapped on duplicate and removed when the target is deleted |

### `properties` by type
- `multiple_choice`: `{options:[{id,label}], allow_multiple:false, allow_other:false}` (1–50 options, unique ids)
- `dropdown`: `{options:[{id,label}]}` (1–500 options, unique ids)
- `rating`: `{max:5, shape:"star"}` (max 3–10; shape `star|heart|number`)
- `number`: `{min?, max?}`
- `short_text`/`long_text`: `{placeholder?, max_length?}`
- `email`, `yes_no`: `{}`

Defaults on create (no `properties` sent): choice/dropdown get 2 options ("Choice 1/2", random ids), rating `{max:5, shape:"star"}`, others `{}`. Unknown keys are rejected.

## responses
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| form_id | FK → forms.id ON DELETE CASCADE | indexed |
| status | TEXT | `partial` \| `completed` |
| started_at | DATETIME | |
| submitted_at | DATETIME NULL | set when completed |
| meta | JSON NULL | `{"token": "..."}` for responses started via `/responses/start` (needed to save progress); never returned by the API |

## answers
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| response_id | FK → responses.id ON DELETE CASCADE | |
| question_id | FK → questions.id ON DELETE CASCADE | |
| value | JSON NOT NULL | see formats below |
| UNIQUE(response_id, question_id) | | |

### `value` formats
- text/email: `"string"` · number/rating: `4` · yes_no: `true|false`
- multiple_choice (single): `"option_id"` · (multi): `["option_id", ...]` · dropdown: `"option_id"`

## Indexes
`questions(form_id, position)`, `responses(form_id, status)`, `answers(question_id)`, `forms(slug)`.

## Derived (not stored)
response_count (completed responses only), completion_rate = completed / total responses, per-question stats computed in `services/stats.py`.
