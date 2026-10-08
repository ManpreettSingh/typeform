# Typeform Original · brand kit v1.0

The design system for this Typeform clone, **measured from real Typeform screens** (workspace, builder, share, results; screenshots taken 2026-10-09). The goal is to look like Typeform, not to invent a new brand. Open `index.html` in a browser for the visual book: palette, live contrast matrix, type scale, spacing, motion demos and components.

## At a glance
- **Mood:** calm, uncluttered tool; conversational, one-thing-at-a-time forms.
- **Colors:** plum-tinted grays with one dark action color. Color only appears in question-type tags and status pills.
- **Type:** one family. Inter stands in for Typeform's licensed TWK Lausanne.
- **Mark:** Typeform's own pill + rounded-square mark, redrawn (`assets/logo.svg`), creator UI only. Unofficial clone, not affiliated with Typeform.

## Primary colors
| Token | Hex | Use |
|---|---|---|
| `ink` | #2A222B | Respondent text and buttons, question-number badge |
| `primary` | #3C323E | Dark buttons (Create form, Add content), titles |
| `text` | #4C414E | Nav, tabs, body |
| `muted` | #655D67 | Secondary labels, icons |
| `surface` | #F7F7F8 | App frame, side panels, toolbar |
| `selected` | #EDEDEE | Active pill, selected row, hover |
| `canvas` | #FAFAFA | Builder canvas, default form background |
| `line` / `line-soft` | #E4E3E5 / #EBEAEC | Control borders / dividers |
| Question tags | #BDDDF9 text · #DDD6FA choice · #C4E3BA rating · #F8CDD8 contact · #FBE19D other | Type chips (icon always `primary`) |

## Core rules
1. Small text uses `ink`, `primary`, `text` or `muted`. `subtle` (3.4–4.0:1) is only for counters and large text; `info` blue is only for icons.
2. One dark button per area (Create form, Add content, Copy link). Everything else is outline or ghost.
3. Panels are `surface` cards with 12px radius on a white page; list rows and tables are white with a 1px `line` border.
4. Active navigation: `selected` pill plus a 2px `primary` underline in the workspace; a 3px bar on top of the tab in the builder header.
5. The default form theme is monochrome: `canvas` background, `ink` text and buttons, a small square number badge.
6. Motion: 150ms `ease` for hover/color, 180ms menus, 240ms modals, 350/250ms question slides, strong ease-out for entering. Exits ~75% of entry. Reduced motion keeps opacity only. No press-scale on buttons (Typeform doesn't do it).
7. Unbuilt Typeform features show a "Soon" badge instead of a paywall or upsell.

## Using the tokens
`tokens.css` is the source of truth. `tokens.ts` and `tokens.json` are generated from it:

```bash
python docs/design/brand-kit/build-tokens.py
```

The app consumes the same values in `frontend/app/globals.css` (Tailwind v4 `@theme`), so components keep using utilities like `bg-bg-subtle` or `text-text-muted`. To use the TypeScript tokens directly, for example in a chart:

```ts
import { color, questionType, duration } from "../docs/design/brand-kit/tokens";

const barColor = questionType.choice; // "#ddd6fa"
const enter = duration.questionIn;    // "350ms"
```

## Where moodforge was bent
Moodforge's standard kit adds a serif display face, a handwritten voice, a manifesto and a mascot. Typeform has none of these, and this project follows Typeform strictly (decision 1 in the design state). Those sections are left out; everything else (tokens in 3 formats, contrast matrix, motion demos, components, voice, files) is here. The logo is Typeform's own mark (user decision, round 5): this is a clone.

## Decision history
See `~/.claude/skills/moodforge/projects/typeform-clone.md` (rounds log, locked decisions, measured references).

## Next steps
1. Step 4: animation review, including the publish/share celebration.
2. Step 5: screens one at a time (workspace, builder, share, results, respondent).
3. Apply the tokens to `frontend/app/globals.css` and the components.
