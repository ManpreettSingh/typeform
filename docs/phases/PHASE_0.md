# Phase 0 — Foundation

## Objective
Runnable skeleton: Next.js + FastAPI + SQLite wired together, with design tokens and shared UI primitives. No product features yet.

## Read first
`ARCHITECTURE.md`, `DESIGN_SYSTEM.md`

## Tasks
**Backend**
1. `backend/` with venv, `requirements.txt` (fastapi, uvicorn, sqlalchemy, pydantic, pydantic-settings, pytest, httpx).
2. `app/main.py` app factory, CORS for `http://localhost:3000`, router prefix `/api`.
3. `core/db.py`: engine (`sqlite:///./app.db`, `check_same_thread=False`), `SessionLocal`, `get_db` dependency, `PRAGMA foreign_keys=ON` on connect.
4. `GET /api/health` → `{status:"ok"}`.
**Frontend**
5. `create-next-app` (TS, App Router, Tailwind, ESLint). Install framer-motion, @tanstack/react-query, zustand, sonner, @dnd-kit/core, @dnd-kit/sortable, lucide-react, clsx.
6. Tokens in `globals.css` + Tailwind theme per `DESIGN_SYSTEM.md`; Inter font via `next/font`.
7. `lib/api.ts` fetch wrapper (base URL from `NEXT_PUBLIC_API_URL`, JSON, error normalisation).
8. Providers: QueryClientProvider + `<Toaster />`.
9. `components/ui/`: Button, IconButton, Modal, Input, Toggle, Badge, Tabs, Menu (dropdown), ConfirmDialog.
10. Home page calls `/api/health` and shows result (temporary).
**Repo**
11. Root `README.md` stub, `.gitignore`, `.env.example` files, `Makefile` or npm scripts to run both.

## Deliverables
Folder structure per ARCHITECTURE.md; both servers run.

## Acceptance criteria
- [ ] `uvicorn app.main:app --reload` serves `/api/health`
- [ ] `npm run dev` page shows backend health
- [ ] `npm run build` + `tsc --noEmit` pass
- [ ] UI primitives visible on a temporary `/dev/ui` page
- [ ] `PROGRESS.md` updated

## Out of scope
Models, real endpoints, any feature screens.
