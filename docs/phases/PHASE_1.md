# Phase 1 — Database & Core Backend API

## Objective
Complete, tested backend for forms, questions, and publishing. Seed script skeleton.

## Read first
`DATABASE_SCHEMA.md`, `API_SPEC.md`

## Tasks
1. SQLAlchemy models: Form, Question, Response, Answer exactly per schema (FKs, cascade, CHECKs, indexes, JSON columns).
2. Create tables on startup (or Alembic initial migration).
3. Pydantic schemas: FormCreate/Update/Out/ListItem, QuestionCreate/Update/Out, per-type `properties` validation.
4. Slug generator (`secrets.token_urlsafe` short, collision-checked).
5. Routers: forms CRUD, duplicate, publish/unpublish (reject publish with 0 questions), questions CRUD, order endpoint (transactional renumber).
6. Default `properties` per type when creating a question (e.g. 2 default options for choice, rating max 5).
7. `GET /forms` includes `response_count` (single aggregate query, no N+1).
8. Consistent error format.
9. `seed.py` skeleton: creates default data idempotently (full data comes in Phase 8; add 1 simple form now).
10. Tests (pytest + TestClient, temp DB): CRUD, duplicate copies questions not responses, reorder, publish rules, cascade delete.

## Acceptance criteria
- [ ] All Forms/Questions endpoints in `API_SPEC.md` work via `/docs`
- [ ] Reorder persists and positions are contiguous
- [ ] Duplicate produces new slug, draft status
- [ ] Deleting form removes questions/responses/answers
- [ ] Tests pass
- [ ] `types.ts` created mirroring schemas
- [ ] `PROGRESS.md` updated

## Out of scope
Public/response endpoints (Phase 5), stats (Phase 6).
