# Typeform live reference (measured 2026-10-09)

Measured from the real admin.typeform.com (logged in as the owner) with computed styles, plus
the screenshots in `D:\screenshots`. This is the spec for the remaining redesign screens. Colors are
the computed values; most already exist as tokens in `frontend/app/globals.css`.

## Global
- **Font (admin UI):** `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif`. Body 14px. (Respondent screens use the form theme font.)
- **Text colors:** title `#3c323e` (rgb 60,50,62), tab/nav `#4c414e`, muted `#655d67`, disabled `#c4c1c5`.
- **Radii:** buttons / pills / inputs 8px; small buttons (24px tall) 6px; rows, cards, panels 12px; dialogs 16px.
- **Transitions:** `background-color .2s, color .2s, border-color .2s` (plain `ease`).
- **Buttons:** primary bg `#3c323e`, white, 500 14px/20, h32, pad 1px 12px. Outline: bg `rgba(255,255,255,.8)`, border 1px `rgba(81,76,84,.15)`, text `#655d67`. Ghost: transparent, `#655d67`. Small: h24, 13px/17 500, pad 1px 8px, radius 6. Large (error page): h44, 16px/24 500, radius 12, pad 0 16px.
- **Green upsell button** ("View plans"): `#177767`. Not used by us.
- **Badge (Beta/Soon/"Match quiz"/"+1"):** 12px, `#01487f` on `#f6fafd`, border `#bdddf9`, radius 8 (10 on "+1"), pad 0 8px, h20.
- **Overlay:** `rgba(70,62,72,.7)`. **Dialog:** bg `#f7f7f8` (white header area), radius 16, `box-shadow: 0 0 0 3px rgba(84,80,88,.09)`. Add content dialog fades `opacity .3s ease-out`; the search dialog has no animation.
- **App frame:** page white, content panel `#f7f7f8` radius 12 inset 16px (header 56px above it).

## Form header (builder / share / results)
- 56px, white. Left breadcrumb: panel icon + "Forms" (500 14 `#655d67`) › form title (500 14).
- Center tabs **Content · Workflow · Connect · Share · Results**: 500 14, h32, pad 0 12, muted; selected `#4c414e` with a 3px bar on the **top** edge.
- Right: copy-link icon button (outline), Publish / "Publish edits" (primary, with ▷ icon), help, avatar.

## Create flow
- "Create form" **immediately creates** a form named **"New form"** and opens `/form/{id}/create`. An empty form shows the AI start screen (header has only the breadcrumb):
  - "Typeform AI" 500 14 muted; "What would you like to create?" 24px/32 400 `#3c323e`.
  - **AI prompt box:** outer halo bg `#f9f2fd`, radius 12, pad 10, `box-shadow: 0 0 0 3px rgba(84,80,88,.09)`, `transition: transform .3s ease-out, box-shadow .6s cubic-bezier(.55,0,.1,1)`. Inner box white, border 1px `#ddb7f0`, radius 6, inset shadow `0 0 0 1px rgba(83,78,86,.12)`; 460×148. Textarea 14px/20, 96px tall. Bottom row: mic, +, … (24px icon buttons) and a send button (24px, bg `rgba(89,86,93,.04)`, border `rgba(86,82,90,.08)`, icon `#c4c1c5` when empty).
  - **Typewriter placeholder** cycles "Explain the goal of your form." / "Type or paste your form questions.": types ~1 char per 50ms, holds ~2s, deletes ~1–3 chars per 50ms, waits ~450ms empty, next phrase.
  - Under it: 1px divider (432px), then two 216×44 tiles (bg `rgba(89,86,93,.04)`, radius 12, pad 6) holding ghost buttons **Start from scratch** and **Sync to CRM** (we skip CRM).
- **Start from scratch** opens the **Add content** dialog. Its tabs: Add form elements · Import questions · **Create with AI**. The AI tab lists cards (For all forms / For lead qualification forms / Product recommendation quiz [Match quiz] / Personality quiz [Match quiz]); "For all forms" shows the prompt box beside "Typeform AI / What would you like to create?" plus the other three cards below. Cards: white, border, radius 12, 40px tinted icon tile.
- The builder has a **"Chat to create"** AI bar centered under the canvas; the workspace sidebar has **"Ask Typeform AI"** at the bottom (opens an assistant panel: "What do you want to achieve?").

## Share page (`/form/{id}/share`)
- **Landing** (screenshot 001217): "Choose how you'd like to share your form" (24px). White card (radius 12, pad 24): [Copy link] primary + URL field (with "Edit" pencil) + QR icon; divider; "Link preview" + "Customize ▾"; preview card (thumbnail tile, title, description, domain). "Embed form" with 2 cards 296×96: "On your website" (lilac `#ddd6fa` image tile) and "In your email" (blue `#bdddf9`). Button "Explore other ways to share" (outline).
- **Detailed view:** left nav (224px, items h40 radius 8, active bg `rgba(87,84,91,.06)`): Share the link · Embed in an email · Embed in a web page · Get targeted respondents. Center: toolbar [Copy link] + URL input + Edit + email + QR; below, a mock browser page with the link preview. Right panel: "Share in:" 40×40 outline icon buttons (Facebook, LinkedIn, X, Buffer, Linktree); "Link preview": Thumbnail Upload, Title input, Description textarea (bg `#fafafa`, radius 12), "Show in search results" toggle.
- Blue info banner across the top when there are unpublished edits: "This form has unpublished edits. Publish to share the latest version." (toast colors `#fafcff` / `#9ac9f4`, radius 8, 16px text, ✕).
- Embed in a web page: Embed name, "Start embedding", device toggle; right tabs Design / Advanced / Embed SDK; Embed mode (Standard, Full-page, Popup, Slider, Popover, Side tab); Settings width (%), height (px), Full-screen on mobile, Hide headers, background transparency.

## Results (`/form/{id}/results`)
- Sub-tabs bar (white, h56): Smart Insights 💎 · **Form performance** (#insights) · Response summary (#summary) · Responses [n] (+1 badge). 500 14; selected `#4c414e` with a 3px bar **under** it (::after, bottom −12px).
- Content is centered (~1192px max) on `#f7f7f8`.
- **Form performance:** "Form performance" 24px/32 400; "Key metrics that show how your form is doing." 16px/20 muted; divider; filters (All time, All devices). "At a glance" 21px/28. Five cards (white, radius 12, pad 12, h120): label 500 14 muted, value 31px/36 400 `#3c323e`: **Views, Starts, Submissions, Completion rate, Time to complete (mm:ss)**. Zero data: 0 / 0 / 0 / — / —. Then a paid "See where users drop off" upsell (skip).
- **Response summary:** header + "A breakdown of form responses and key takeaways for each question."; toolbar: segmented [list, ↑, ↓] (sort default / high→low / low→high), segmented [#, %], All time, Filters. Question cards: white, radius 12, pad ~28; type tag chip (qt color, icon + number) + title; "X out of Y people answered this question." Text answers: search input ("Search responses") + "N result(s)" + grid of answer cards (322w, white, radius 12, pad 16, border; quote icon, text 14px, relative time 13px muted). No data: "Waiting for responses" (24px) / "Your data will appear here." centered in the card.
- **Responses:** toolbar: segmented [Responses | Spam [0]] (h30, radius 7, selected white + inset ring), search, All time, Filters; right: density, columns, download icons, "Generate test response" (outline). Table: white; th 56px tall (13px labels with qt icon tiles); td pad 8px 12px, borders `rgba(83,78,86,.12)`; Response time = two lines (12px date `#4c414e`, 12px time muted); Response type badge "Completed" (12px `#1a513a` on `#f9fbf7`, border `#c4e3ba`, radius 8). Row hover shows an expand icon ("Open response details").
  - **Response panel** docks on the right (438px, bg `#f7f7f8`), opens **instantly** (no slide). Header: ↑ ↓, "Oct 9, 2026 12:14 AM", badge, ⋮, ✕. Cards (white, radius 12): Tags (+ Add tags); answers (qt icon + question title, answer below, dividers); Ending; Response ID.
- **Empty:** "No responses" (21px/28) / "Share your form to start collecting data, or generate sample responses to test your workflow" (14px muted) + [Share your form] primary + [Generate test response] outline.

## Error / empty states
- Error page: 48px icon tile (radius 8, bg `#f8e4e3`, icon `#673222`), "Sorry, something went wrong" 24px/32, text 16px/20 muted with underlined muted links ("server status", "contact support"), [Refresh page] large button.
- Workspace search is a **dialog**: "Search" title (21px, pad 32 32 0), input "Search in {account}" (16px), results grouped under "Forms" (rows h32, radius 8, first highlighted with a 2px inset ring); none: "No results found" / "Try again using other search terms."
- Workspace rows load with shimmer skeleton cells; rows are white, radius 12, h48.
