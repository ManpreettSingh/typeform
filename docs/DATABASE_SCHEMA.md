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
| thank_you | JSON | `{title, message, button_text?, button_url?}`; superseded by `endings` (kept for older clients) |
| welcome | JSON NOT NULL, default `{}` | welcome-screen options `{button_text?, show_time_to_complete?, show_submission_count?}` |
| views | INTEGER NOT NULL, default 0 | times the public form was opened |
| created_at / updated_at / published_at | DATETIME | |

## questions
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| form_id | FK → forms.id ON DELETE CASCADE | indexed via UNIQUE(form_id, position) |
| type | TEXT NOT NULL | `short_text, long_text, multiple_choice, dropdown, email, number, yes_no, rating`; validated by the app (the SQL CHECK was dropped by migration `drop_question_type_check`, so new types need no table rebuild) |
| title | TEXT NOT NULL | the question |
| description | TEXT NULL | help text |
| required | BOOLEAN default 0 | |
| position | INTEGER NOT NULL | 0-based, contiguous; UNIQUE(form_id, position). SQLite can't defer UNIQUE, so renumbering moves rows to a free range above max(position) then to final slots, in one transaction |
| properties | JSON | per-type config (below) |
| logic | JSON NULL | bonus: branching rules `{"rules":[{"op","value","to": <question id> \| "end"}]}` (API_SPEC.md "Branching"); null = always the next question. Jump targets are remapped on duplicate and removed when the target is deleted |
| group_id | FK → questions.id ON DELETE CASCADE, NULL | set on the questions inside a group; points at the group's header row (`type = "group"`) |

### `properties` by type
- `multiple_choice`: `{options:[{id,label}], allow_multiple:false, allow_other:false}` (1–50 options, unique ids)
- `dropdown`: `{options:[{id,label}]}` (1–500 options, unique ids)
- `rating`: `{max:5, shape:"star"}` (max 3–10; shape `star|heart|number`)
- `number`: `{min?, max?}`
- `short_text`/`long_text`: `{placeholder?, max_length?}`
- `email`, `yes_no`: `{}`

Defaults on create (no `properties` sent): choice/dropdown get 2 options ("Choice 1/2", random ids), rating `{max:5, shape:"star"}`, others `{}`. Unknown keys are rejected.

## endings
| column | type | notes |
|---|---|---|
| id | INTEGER PK | |
| form_id | FK → forms.id ON DELETE CASCADE | indexed via UNIQUE(form_id, position) |
| position | INTEGER NOT NULL | 0-based; UNIQUE(form_id, position) |
| title | VARCHAR(200) NOT NULL | default "Thanks for completing this form" |
| message | TEXT NOT NULL | default "Your response has been recorded." |
| button_text / button_url | VARCHAR NULL | optional button |

Every form has at least one ending; respondents see the first unless logic picks another. Existing forms got their first ending from the old `thank_you` JSON.

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

## Migrations
`Base.metadata.create_all` creates missing tables only, so changes to existing tables are ordered, idempotent steps in `backend/app/core/migrations.py`
(`MIGRATIONS`, applied by `migrate()` on every startup, after `create_all`). Each step checks whether it still has work to do, carries its own SQL, and has
a test in `backend/tests/test_migrations.py` that starts from `tests/fixtures/schema_v1.sql` (the schema of commit 3f880e4).

| Step | What it does |
|---|---|
| `add_forms_views` | adds `forms.views` |
| `drop_question_type_check` | rebuilds `questions` without the CHECK on `type` (SQLite's 12-step procedure; foreign keys off, copy, swap, `foreign_key_check`) |
| `add_questions_group_id` | adds `questions.group_id` |
| `add_forms_welcome` | adds `forms.welcome` |
| `create_endings_from_thank_you` | creates `endings` if needed and gives each form without endings a first one built from `thank_you` |
