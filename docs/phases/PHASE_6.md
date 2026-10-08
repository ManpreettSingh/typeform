# Phase 6 — Results & Analytics

## Tasks
**Backend**
1. `GET /forms/{id}/responses` (paginated), `GET /forms/{id}/responses/{rid}`, optional DELETE.
2. `services/stats.py` + `GET /forms/{id}/summary`: totals, completion rate, per-question stats (choice/dropdown/yes-no counts + %, rating average + distribution, number min/max/avg, text recent answers).
3. Tests for stats on seeded data.
**Frontend** (`/forms/[id]/results`)
4. Tabs: Summary | Responses. Top stats: total responses, completion rate.
5. Summary: card per question with horizontal bars (CSS/SVG, no heavy chart lib needed), counts and %.
6. Responses table: submitted time, one column per question (truncate), status; pagination; click row → side drawer/modal with full response (question → answer list).
7. Empty state with "share your form" link.
8. CSV export button (backend endpoint; mark bonus).

## Acceptance criteria
- [ ] Table lists seeded + newly submitted responses
- [ ] Individual view shows every answer correctly formatted per type
- [ ] Summary numbers verified against raw data
- [ ] `PROGRESS.md` updated
