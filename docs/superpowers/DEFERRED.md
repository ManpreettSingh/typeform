# Deferred work (to revisit after the fast path)

Owner decision 2026-10-09: the goal is an exact clone of Typeform's free plan, built fast; unimportant parts are skipped now
and listed here so nothing is forgotten. Add to this list whenever something is cut; remove an item when it ships.

## Phase 3 (logic and workflow)
- [ ] `hide` rules (question display) and `hide_choices` rules (hide answer choices): spec `2026-10-09-phase3-logic-design.md` §3.1, §4.1, §5.
- [ ] Logic-map canvas (nodes, arrows, branch buttons, zoom, unreachable-ending warning); the Workflow tab shows the list overview meanwhile.
- [ ] Typeform measurements still open: operator lists for variable / URL-parameter sources, recall list with variables, Hide-choices row.
- [ ] Stripping dangling recall tokens when a question is deleted (they render empty now).
- [ ] Tagging, loop icon, `price` and `segment` variables, Quiz variables, Data enrichment variables (shown disabled "Soon").

## Earlier phases
- [ ] The builder's left column shows "Endings" twice: the card in the pages list (real endings) and a leftover local `EndingsCard` in `FormBuilder.tsx` that still reads `form.thank_you` ("Thanks for completing this..."). Remove the leftover.
- [ ] Rich text in question titles (bold, italic, links); Legal and Checkbox labels show URLs as plain text.
- [ ] Unsplash / Pexels / YouTube / icon tabs and the crop/rotate editor in the media gallery (Phase 2 later step).
- [ ] Junk files `tmp_seed_themes.py`, `tmp_theme.py` at the repo root were committed in `2e647c5`; delete them.

## Typeform AI chat (built 2026-10-09: chat, review view, apply, memory, 4 entry points)
- [x] Browser-checked on localhost:3000 (2026-10-09): workspace box creates a form, builder bar edits one (remove + add, Apply refreshes the builder), design request declined, memory dialog, Create with AI tab, blank-form start screen.
- [ ] Microphone dictation (the mic icon on Typeform's bars) and file upload in the AI chat.
- [ ] The AI can't edit branching rules, groups, themes/design, picture choice or matrix questions yet (it says "not supported yet"). Add rule editing after logic v2 lands (see the stash below).
- [ ] The AI start screen's other cards (lead qualification, product recommendation quiz, personality quiz).
- [ ] Pixel comparison of the review view with Typeform's (one prompt in the scratch draft DaXKht1o would show it; ask the owner first, it sends content to Typeform's AI).
- [ ] Restoring versions works within one session only; proposals aren't stored.

## Parked work (git stash "parked 2026-10-09: parallel wave 1", `git stash list`)
Half-built by parallel agents, then stopped on the owner's request to go feature by feature: logic v2 (backend schemas, TS resolver, golden fixture `backend/tests/fixtures/logic_cases.json`, scoring helpers), templates API, share helpers (QR, social). Resume with `git stash pop` on a clean tree, then re-read `docs/superpowers/specs/2026-10-09-phase3-logic-design.md`.

## Not yet started (parent spec §5)
- [ ] Phase 4: share and embed, results rebuild, form settings and system messages, connect (webhooks/email), templates, workspace parity, version history, accessibility checker.
- [ ] Phase 6: deployment rehearsal on a production DB copy, Railway variables (Gemini, Cloudinary), push, smoke test.
