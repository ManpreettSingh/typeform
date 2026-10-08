# Typeform Clone

A functional clone of Typeform: form builder, shareable public link, one-question-at-a-time respondent flow, and results.

> Work in progress — see `docs/PROGRESS.md`. Full README (architecture, schema, assumptions) lands in Phase 8.

## Stack
- **Frontend:** Next.js (App Router, TypeScript), Tailwind CSS, TanStack Query, Zustand, framer-motion, dnd-kit, sonner
- **Backend:** FastAPI, Pydantic v2, SQLAlchemy 2
- **Database:** SQLite (`backend/app.db`)

## Bonus features
- **Branching / logic jumps** — per question, “if the answer is X → jump to question Y / end the form” (Logic section of a question’s settings; overview under Settings → Logic). Jumps only go forward, so forms can’t loop; progress, “n of N”, back navigation and server validation all follow the respondent’s path.
- **Partial responses + completion rate** — a response is started on the respondent’s first move forward and saved on every step; the results page shows completed vs in-progress responses and the completion rate.
- **Custom themes** — background, text and button colors plus font, applied to the builder preview and the public form.
- **Dark mode** — Light / Dark / System switch for the dashboard, builder and results (forms keep their own theme).
- **CSV export** of all responses.
- **Coming-soon placeholders** — Integrations and Collaborate settings, Payment and File upload question types (shown, disabled).

## Prerequisites
- Python 3.11+
- Node.js 20+

## Setup
```bash
npm install       # root dev tooling (concurrently)
npm run setup     # backend venv + pip deps, frontend npm deps, local .env files
npm run seed      # optional: demo data (idempotent)
```

## Run
```bash
npm run dev       # API on http://localhost:8000, web on http://localhost:3000
```
Or separately: `npm run dev:backend` / `npm run dev:frontend`.

Tables are created on API startup. Interactive API docs: http://localhost:8000/docs

Temporary dev pages: `/` shows backend health, `/dev/ui` shows the UI primitives.

## Checks
```bash
npm run test:backend     # pytest
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run build:frontend   # next build
```

## Configuration
| File | Variable | Default |
|---|---|---|
| `backend/.env` | `DATABASE_URL` | `sqlite:///./app.db` |
| `backend/.env` | `CORS_ORIGINS` | `http://localhost:3000` |
| `frontend/.env.local` | `NEXT_PUBLIC_API_URL` | `http://localhost:8000/api` |

## Docs
Project specs live in [`docs/`](docs/README.md).
