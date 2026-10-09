# Handoff: Typeform Clone - Video, Workflow, Contacts, Automations

Updated 2026-10-09.

## Project
Typeform clone for an SDE assignment, at `C:\Users\HP\OneDrive\Desktop\typeform`.
- **Stack:** Next.js 16 (TypeScript) in `frontend/`, FastAPI with SQLite in `backend/`.
- **Repo:** github.com/ManpreettSingh/typeform, branch `main`.
- **Live:** frontend https://forms.preet.cloud, API https://typeform-production-3059.up.railway.app/api. Both deploy automatically from `main`.
- `SEED_DEMO_DATA=true` is set on Railway, so the live demo has its sample forms (`demo-feedback`, `demo-event`). Cloudinary is configured on the live API.

## Owner's rules
- Commit and push to `main` without asking, once work is finished and verified. Work on one feature at a time.
- Commit messages: write the message to a file and use `git commit -F <file>`. Windows PowerShell breaks inline messages that contain double quotes. Check `git diff --cached --stat` before every commit, because anything already staged gets swept in. End messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- **Never test against ports 3000/8000.** Those are the owner's own dev servers with their real database. Use the isolated test stack instead:
  - `npm run e2e:start -- --seed` starts it on 3100/8100, with a throwaway database and a fake Cloudinary on 8101.
  - `npm run e2e:stop` stops it.
- **Browser checks:** the scripts in `docs/superpowers/browser-checks/` run in headless Edge with `playwright-core`.
  - `assignment-smoke.mjs` covers the whole checklist; `file-upload.mjs` passes 9/9; `media-canvas.mjs` covers image layouts.

## Done and pushed (most recent: `6eaca6b`)
- Every requirement and bonus in assignment checked end to end.
- Image layouts match Typeform's, ending images saved.
- Bug fixes pushed.
- Answer-type menu scrollable.
- Results → Content/Workflow/Connect opens the right tab: builder's view in URL as `?view=`.
- Tests: backend 529 pass; frontend 133 pass.

## In progress: Video Question & Video Media
- Backend schemas, router, services, tests.
- Frontend QuestionSettings, VideoQuestionDialog, MediaCanvas, QuestionRenderer, QuestionShell, BuilderCanvas, QuestionList.
- Fake services endpoint `/video/upload`.

## Next features to build
1. Finish, verify, commit and push Video feature.
2. Workflow tab, minimal but complete (logic map flow visualization).
3. Contacts and Automations tabs.
