# Phase 8 — Seed, README, QA & Submission

## Tasks
1. **Seed** (`python -m app.seed`, idempotent): ≥2 published forms with mixed types (e.g. "Customer Feedback", "Event Registration"), 1 draft; 15–40 realistic responses each with varied answers, a few partial; varied timestamps.
2. **README.md** (root): overview + screenshots/GIF, setup (backend, frontend, seed, env), tech stack, architecture overview, DB schema (ER diagram/table), API summary, assumptions (no auth, default creator, cascade deletes, slug links, etc.), bonuses done, placeholders, known limitations.
3. **QA checklist** — run through every item in `PROJECT_BRIEF.md` + `PROGRESS.md` on a fresh clone with a fresh DB.
4. Test: backend `pytest`, frontend type-check/lint/build.
5. Cleanup: remove dead code, `/dev/ui` page, console logs; consistent naming; .env.example complete.
6. Verify fresh-clone setup in under 5 minutes following only the README.
7. Final visual comparison against real Typeform; fix top 5 discrepancies.
8. Optional: deploy (Vercel + Render/Fly) and add links.

## Acceptance criteria
- [ ] Fresh clone → seed → app immediately usable with data
- [ ] README complete
- [ ] All must-have boxes in `PROGRESS.md` checked
- [ ] No plagiarism concerns: all code original
