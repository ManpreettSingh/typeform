# Architecture

## Stack
| Layer | Choice |
|---|---|
| Frontend | Next.js (App Router) + TypeScript, Tailwind CSS |
| Animation | framer-motion (respondent transitions, builder micro-interactions) |
| Drag & drop | @dnd-kit/core + @dnd-kit/sortable |
| Data fetching | TanStack Query (cache, optimistic updates) |
| Local UI state | Zustand (builder editor state) |
| Toasts | sonner |
| Backend | FastAPI + Pydantic v2 |
| ORM | SQLAlchemy 2.x (+ Alembic optional) |
| DB | SQLite (file: `backend/app.db`) |

## Repo layout
```
/
├── docs/                      # this folder
├── backend/
│   ├── app/
│   │   ├── main.py            # app factory, CORS, router include
│   │   ├── core/              # config, db session
│   │   ├── models/            # SQLAlchemy models
│   │   ├── schemas/           # Pydantic schemas
│   │   ├── routers/           # forms.py, questions.py, public.py, responses.py
│   │   ├── services/          # business logic (duplicate, validation, stats)
│   │   └── seed.py
│   ├── tests/
│   └── requirements.txt
├── frontend/
│   ├── app/
│   │   ├── (dashboard)/forms/            # form list
│   │   ├── forms/[id]/edit/              # builder
│   │   ├── forms/[id]/results/           # responses + summary
│   │   └── f/[slug]/                     # PUBLIC respondent flow
│   ├── components/{ui,dashboard,builder,respondent,results}/
│   ├── lib/{api.ts,types.ts,validation.ts}
│   └── store/builderStore.ts
└── README.md
```

## Key decisions
1. **Public id = `slug`** (short random string) for respondent URLs; internal id = UUID/int. Never expose edit routes publicly (no auth, so edit URLs are by id — acceptable per brief).
2. **Question type-specific config lives in `properties` JSON** (options, rating max, placeholder) → one `questions` table, no per-type tables.
3. **Answers stored as one row per (response, question)** with JSON `value` → easy stats and CSV export.
4. **Single validation module on backend** (`services/validation.py`) mirrored by `lib/validation.ts` on frontend. Server is authoritative.
5. **Builder saves via debounced autosave** of changed questions + a bulk reorder endpoint.
6. **Live preview reuses the respondent components** (`components/respondent/*`) in a `preview` mode → guarantees fidelity and avoids duplicate code.
7. **Only published forms are fillable**; draft → 404/"not available" screen.
8. Deleting a question that has answers: cascade-delete its answers (documented assumption).

## Data flow (respondent)
`GET /api/public/forms/{slug}` → client renders flow → (optional partial `POST /responses` start + `PATCH` progress) → final `POST /api/public/forms/{slug}/responses` → server validates → 201 → thank-you screen.
