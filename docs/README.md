# Typeform Clone — Docs Index

Single source of truth for the project. Read in this order:

| File | Purpose |
|---|---|
| `PROJECT_BRIEF.md` | Assignment requirements + evaluation criteria (what "done" means) |
| `ARCHITECTURE.md` | Stack, folder layout, data flow, key decisions |
| `DATABASE_SCHEMA.md` | Tables, columns, relationships, answer-value formats |
| `API_SPEC.md` | Every endpoint, request/response shape |
| `DESIGN_SYSTEM.md` | Tokens, typography, motion, per-screen UI notes |
| `PROGRESS.md` | **Current phase, feature checklist, session log. Update after every task.** |
| `phases/PHASE_0..8.md` | Executable spec per phase |

## Workflow
1. Open `PROGRESS.md` → find the current phase.
2. Give the agent: `ARCHITECTURE.md` + the current `phases/PHASE_N.md` (+ schema/API/design docs if the phase touches them).
3. Agent implements only that phase. You verify against its Acceptance Criteria.
4. Update `PROGRESS.md`, commit, move to next phase.
