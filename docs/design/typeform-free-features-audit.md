# Typeform free-plan audit (2026-10-09)

Read-only audit of the real Typeform (admin.typeform.com, the owner's free account) plus Typeform's public
help center and pricing page. It defines the scope for "clone all the free features". Anything marked
**paid** is out of scope (the admin shows it with a green diamond or the aria text "Your current plan does
not include this feature"). Companion docs: `typeform-live-reference.md` (measured layout, colors, motion).

Sources: help center "Free plan" article (help.typeform.com/hc/en-us/articles/360032972852-Free-plan),
"Question types" article (360051789692), the builder's Add content dialog, Form settings dialog, Design
gallery, www.typeform.com/pricing.

## 1. What the Free plan includes (per Typeform)
- Unlimited forms. 10 responses/month across all forms (we do not limit responses).
- Templates (pre-designed) and own images + color palette.
- **Logic**: branching, plus calculations, scores and variables.
- **URL parameters** (formerly Hidden Fields): save/show respondent info from the form URL.
- **Custom endings**, and **multiple endings** to show different outcomes.
- **Embedding** in several formats (web page). Downloading results as a spreadsheet.
- Basic reports and metrics in Results (drop-off analysis is Business+).
- Integrations (Connect panel): Calendly, Zapier, Google Sheets, Slack, Mailchimp, Airtable (+ more).
- Import from Google Forms. APIs for building forms and reading responses.
- Typeform AI: a chatbot that builds forms from a description.

### Free question types (21 names, Short and Long Text counted separately) — help center
Address, Contact Info, NPS, Phone Number, Short Text, Long Text, Multiple Choice, Picture Choice, Statement,
Ranking, Question Group, Dropdown, Yes/No, Email, Rating, Date, Legal, Opinion Scale, Matrix, Number, Website.
The builder also offers **Checkbox** (single consent checkbox) and **Scheduler** (Calendly / Google Calendar)
without a paid marker, plus Welcome Screen and End Screen blocks.
We already have 8 of these (short/long text, multiple choice, dropdown, email, number, yes/no, rating), so **14 are
new**: Contact Info, Phone Number, Address, Website, Picture Choice, Legal, Checkbox, NPS, Opinion Scale, Ranking,
Matrix, Date, Statement, Question Group. Scheduler needs a calendar service, so it stays "Soon".
A question's type can be **changed** afterwards from the Answer dropdown (not for Endings / Question Group).

### Paid only (do not build; show as "Soon" or omit)
Payment, File upload, Signature, Video and Audio, Clarify with AI, FAQ with AI, Partial submit points, Redirect
to URL, knowledge-quiz mode, brand logo, remove Typeform branding, premium themes, brand kits, custom links /
subdomains / domains / fonts, custom social-share metadata, button links on End Screens, respondent access
management, multi-language (translations), reCAPTCHA and bot detection, prevent duplicate responses, advanced
embed launch options, close-on-submit, schedule a close date, response limit, custom closed message, follow-up
emails, lead scoring/routing, enrichment, Smart Insights, drop-off analysis, optimization tips, comments, team
seats/roles, Contacts and Automations, SSO, EU hosting, Salesforce / Pipedrive / GA / GTM / Meta Pixel.

## 2. Add content catalog (builder dialog; tabs: Add form elements · Import questions · Create with AI)
Free items by group (paid ones omitted):
- **Contact info:** Contact Info, Email, Phone Number, Address, Website
- **Choice:** Multiple Choice, Dropdown, Picture Choice, Yes/No, Legal, Checkbox
- **Rating & ranking:** Net Promoter Score, Opinion Scale, Rating, Ranking, Matrix
- **Text & Video:** Long Text, Short Text
- **Other:** Number, Date, Scheduler
- **Structure:** Welcome Screen (one per form), Statement, Question Group, End Screen
- Left rail: "Recommended" (Video and Audio [paid], Short Text, Multiple Choice) and "Connect to apps" (HubSpot,
  Salesforce [paid], Browse all apps).

## 3. Builder chrome (free account)
- Top-left **form mode** selector ("Universal mode"). Pages list: Welcome Screen tile, one card per question
  (type tag + number + title, drag handle, hover "+ Add content" between cards), "Add Partial Submit Point" [paid],
  Endings card with "+".
- Toolbar: Add content · Design · Mobile view · Preview · Accessibility modal · Version History · Translations
  [paid] · Form settings · Hide question panel. "Chat to create" AI bar under the canvas.
- Right panel per block: Question (Text | Video [paid]) · Answer (type dropdown + per-type settings) · Image or
  video · Logic (+) · Comments [paid].
- Routes: Content `/form/{id}/create`, Workflow `/form/{id}/logic`, Connect `/form/{id}/connect`, Share
  `/form/{id}/share`, Results `/form/{id}/results`; selected block in `?block=<uuid>`.
- Welcome Screen panel: "Time to complete" switch (shows "Takes X minutes", calculated), "Number of submissions"
  switch (social proof), Button text (max 24 chars), Image or video.

### Answer panels observed
- **Phone Number:** Map to contacts [paid], Required, default country dropdown (flag + name); canvas input shows a
  country flag selector and a "(201) 555-0123" placeholder.
- **Long Text:** Map to contacts [paid], Required, Max characters, Answer validation, Custom placeholder text.
- **Date:** Map to contacts [paid], Required, Date format (MMDDYYYY / DDMMYYYY / YYYYMMDD + separator `/` `-` `.`),
  Start date, End date; canvas shows Month / Day / Year inputs "MM / DD / YYYY".

## 4. Form settings dialog (gear) — sections General · Access & Scheduling · Language · Block references
**General**
- Form mode (Universal; "switching modes might change form settings").
- Display switches: Typeform branding [paid to hide], Navigation arrows, Progress bar, Question number,
  Asterisks (*) to show required questions, Letters on answers.
- Preferences: Autosave progress, Free form navigation, Cookie consent, Enrich form responses [paid], Capture
  partial responses after every question [paid], Spam prevention [paid], Duplicate response prevention [paid].
- Notifications: Send email for new responses, Send email when form is signed [paid], Send email to [Add email].

**Access & Scheduling:** banner "Your typeform is open to new responses." Switch "Open this form to new responses"
(free). Schedule a close date, Set a response limit, Show custom closed message are paid.

**Language:** Main language (English), Translations [paid], and **System messages** (all editable, default text):
- Buttons/hints: OK · "press Enter ↵" · "Choose as many as you like" · dropdown "Type or select an option" /
  touch "Select an option" · "None of the above" · "Other" · "Type your answer" · "Type your answer here..." ·
  "Key" (hint when hovering options) · Yes / No (keys Y / N) · Legal "I accept" / "I don't accept" · "Review" ·
  "Submit" · "Continue" (quiz) · long text "Shift ⇧ + Enter ↵ to make a line break".
- Multiple-selection instructions: "Choose {min} / {additional} more", "You can choose up to {max}", "You can
  choose {additional} more", "Make between {min} and {max} choices", "Choose at least {min}".
- Errors: required "Please fill this in" (also with field name "Please fill in {field_title}") · selection
  "Oops! Please make a selection" · value "Oops! Please enter a value" · legal "Please agree to the terms & conditions" ·
  email "Hmm... that email doesn't look right" · URL "Hmm… that web address doesn’t look right. Check for any typos or
  errors." · number "Please enter a number between {min} and {max}" / "greater than {min}" / "lower than {max}" ·
  dropdown "No suggestions found" · phone "Hmm... that phone number doesn't look right" · date "Choose a date on or
  after {min}." / "on or before {max}." / "between {min} and {max}." / "That date doesn't look valid—it's incomplete or
  doesn't exist" / "That date isn't valid. Check the month and day aren't reversed."
- Completion: "All done! Thanks for your time." · connection "Oh no, you can’t connect to the server right now" ·
  server "Server error! Your request wasn't completed" · unavailable "The typeform {name}, is currently unavailable.
  Please try again in a few moments."
- Date range hints: "Choose a date on or after {min}." etc., closed "This date range is closed. It closed on {max}."
- File upload strings (paid type): skip.

## 5. Design gallery (Design popup: tabs My themes · Gallery; Brand kit themes [paid])
56 themes, **30 free** (rest premium). Fonts used by free themes: Inter, system-ui, Karla, Georgia, Sniglet,
Raleway, Montserrat, Oswald, Lekton, Arvo. `img` = the theme has a background image (must be reproduced with our
own artwork or gradients). Colors are computed values (bg / question / answer / button).

| Theme | Font | bg | question | answer | button | img |
|---|---|---|---|---|---|---|
| Pearl White (default) | Inter | #fafafa | #2a222b | #2a222b | #2a222b | |
| Classic Blue | system-ui | #ffffff | #000000 | #0445af | #0445af | |
| Inky Black | Inter | #2a222b | #fafafa | #fafafa | #fafafa | |
| Plain Blue | system-ui | #ffffff | #3d3d3d | #4fb0ae | #4fb0ae | |
| Plain Dark | Karla | #ffffff | #37404a | #5c5c5c | #37404a | |
| Plain Mud | Karla | #ffffff | #9f5318 | #cb732b | #cb732b | |
| Plain Sun | Karla | #ffffff | #b89837 | #e4ba3f | #e4ba3f | |
| Plain Grass | Karla | #ffffff | #5b9d6f | #7dbb91 | #7dbb91 | |
| Paper Invite | Georgia | #e5e1da | #2a3146 | #c44665 | #2a3146 | yes |
| Art Splash | Sniglet | #f2eee9 | #3d3d3d | #437e93 | #97d5e2 | yes |
| Staged | Raleway | #0b0b0b | #ffffff | #ffffff | #fbfbfb | yes |
| Filo Fax | Karla | #f1ece2 | #262626 | #262626 | #262626 | |
| Orbital | Montserrat | #e3d8df | #262626 | #262626 | #ffffff | yes |
| Smart Ash | Karla | #262626 | #f1ece2 | #f1ece2 | #f1ece2 | |
| Taxi | Oswald | #f9cd48 | #040404 | #000000 | #252525 | |
| Techie | Lekton | #f3f3f3 | #040404 | #7e7e7e | #5182e0 | |
| Spaceboy | Arvo | #1e1e45 | #ffffff | #407fd4 | #4dc950 | yes |
| Plain Raspberry | Karla | #ffffff | #8b3249 | #c75875 | #c75875 | |
| Plain Purple | Karla | #ffffff | #7a3d7c | #c384c5 | #c384c5 | |
| Splash Sea | Karla | #408e91 | #eeeeee | #eeeeee | #eeeeee | |
| Splash Blue | Karla | #4fb0ae | #eeeeee | #eeeeee | #eeeeee | |
| Splash Mud | Karla | #cb732b | #eeeeee | #eeeeee | #eeeeee | |
| Splash Grass | Karla | #7dbb91 | #eeeeee | #eeeeee | #eeeeee | |
| Splash Purple | Karla | #c384c5 | #eeeeee | #eeeeee | #eeeeee | |
| Washed Jungle | Karla | #f3f9ef | #6cbf2c | #89bc62 | #c6dfb2 | |
| Washed Mud | Karla | #faf1ea | #e66902 | #cb732b | #e6bb98 | |
| Washed Sun | Karla | #fdf8ec | #e6ac00 | #e4ba3f | #edd59a | |
| Washed Raspberry | Karla | #faeef1 | #bf395d | #c75875 | #e4adbc | |
| Washed Purple | Karla | #f9f3fa | #c968cc | #c384c5 | #e2c3e3 | |
| Washed Blue | Karla | #f1f9fa | #38bdcf | #73bec8 | #bbe0e5 | |

Premium (skip): Barceloneta, Eixample, Montjuic, Wavvves, Desk Space, Fractal, Orange, Forest, Sky, Moon, Saturn,
Venus, Glide, Current, Ramble, Quantity, Quality, Questions, Pulse, Classroom, Galactic, Quiz me, Waveform, Green
sheen, Touch, Natural light.

## 6. Public templates gallery (www.typeform.com/templates)
Browse by Role (Sales, Product, Marketing, HR, Customer success), Goal (Get feedback, Make sales, Plan events,
Conduct research, Engage audience, Recruit talent, Generate leads) and Form type (Forms, Surveys, Quizzes, Polls).
~60 templates, each a "View template" page leading to "Use this template". We write our own original templates for the
same categories.

## 7. Workflow tab (`/form/{id}/logic`)
A **logic map**: nodes for Welcome → each question → Ending, joined by branch buttons; zoom controls bottom-right;
"Chat to create" bar. Toolbar sub-tabs:
- **Logic** (the map; per-question rules). Help center: and/or conditions, jump to question or ending, variables,
  hide questions by answer or URL parameter, "Logic Map".
- **Scoring** (free): dialog "Score quiz — Assign points to answers" (Cancel / Save / Delete all rules).
- **Outcome quiz** (free): dialog "Show different quiz endings based on how people answer" — each chosen answer adds
  one point to its related ending; the highest-scoring ending is shown. "+ Add Ending".
- **Tagging**: "Create groups of tags…" with rules "Tag as … when … / all other cases". The help center files it
  under Lead scoring (paid), so out of scope.
- Toolbar icons: Preview, Variables `(x)`, a loop icon, settings.
- Left card **Pull data in** (URL parameters, formerly Hidden Fields). Right **Actions** rail: Connect (Google
  Sheets, Excel, …), Automations [paid], Contacts [paid].

## 8. Connect tab (`/form/{id}/connect`, tabs INTEGRATIONS · WEBHOOKS)
- 82 integrations in 14 categories (Analytics & reporting 20, Automation 1, CMS 2, Collaboration 17, Customer support 8,
  Developer tools 6, Documents 6, File management 4, Lead generation 19, Marketing automation 35, Payments &
  e-commerce 5, Productivity 15, Research & CX 3, Sales 11). Search box, category list with counts.
- Top: "Generate a custom flow with Zapier AI" (prompt box), Typeform contacts [paid]. Cards: logo, one-line
  description, **Connect** button (paid ones: Facebook Pixel, Google Analytics, GTM, Salesforce, Airtable "paid plans").
  Free examples: HubSpot, Google Sheets, Excel, Mailchimp, Slack, Microsoft Teams, Notion, Dropbox, Email
  ("Get email notifications letting you know of a new entry"), SMS, Zapier, Make, Trello, Asana, Discord, …
- **Webhooks:** empty state "Trigger webhooks — Not familiar with webhooks? Just ask your tech team…" + [Add a webhook].
  Not marked paid in the free account.

## 9. Workspace (admin home) extras
- Row menu on a form: Copy link · Content · Workflow · Connect · Rename · Duplicate · Copy to ▸ · Move to ▸ · Delete.
- Sort menu: Date created · Last updated · Alphabetical. Sidebar: Workspaces `+`, Private › My workspace (count),
  "Responses collected 1/10" meter, "Increase response limit", **Ask Typeform AI** box (focus ring only; opens a
  chat on first message).
- Section tabs: Forms · Contacts [paid] · Automations [paid] · Insights [paid] · Pages (Beta, AI landing pages) ·
  Research Flow. Top bar: Integrations, Brand kit [paid], help, avatar. Dismissible promo cards and a usage banner.
- Account menu: Account settings (`/user`: Account settings, Communications, Authorized apps, **Personal tokens** for
  the free API), Support, Help center, Community, What's New, Refer friends, Homepage, Log out.
- Builder extras (free): **Version History** ("Load recently published versions of your form"),
  **Accessibility** checker (categories Color · Alt text · Content · Other, each "All clear!").

## 10. Typeform AI (assistant) — behavior to copy with Gemini Flash-Lite
Source: help center "Use Typeform AI". Entry points: workspace "Ask Typeform AI", builder "Chat to create", create flow.
- Can: create, edit, reorder, delete questions; create/edit/delete End Screens; edit question settings; create/edit/
  delete branching rules; add recalled information; suggest improvements; preview suggested changes; restore previous
  versions of suggested changes. Reports "not supported yet" for design/theme edits and scored endings.
- Flow: prompt (or pasted questions; mic dictation) → "thinking" → **review view** with the suggested form, Preview,
  continued chat at bottom-left, **Apply changes to form** (saves, returns to Content) or ✕ (confirm discard).
- Memory: up to 2,000 chars of user context (company, tone, audience), editable from the ⋯ menu.
- Free-plan limits: 1 uploaded file per month (≤3 per conversation, ≤20 MB; pdf/doc/csv/txt/…). Extended Thinking and
  connectors are paid. Optional: web lookup when a URL or company name is in the prompt.

## 11. Comparison with our app (deployed 0942d22: Vercel frontend, Railway API)
The deployment is the redesign through commit `0942d22`; the data is the owner's own test forms (4 forms, 0 responses).
Workspace and builder match Typeform's structure; **Results is still the pre-redesign layout**, there is no Share page,
and nothing from the uncommitted phase-2 backend (AI, views, test responses) is live.

| Area | Typeform free | Our app |
|---|---|---|
| Question types | 20 free + Checkbox, Scheduler | 8 (short/long text, multiple choice, dropdown, email, number, yes/no, rating); no type change |
| Screens | Welcome (button, time-to-complete, submission count, image/video), multiple Endings, Statement, Question Group | Welcome (title/description), one thank-you ending |
| Logic | Logic map, and/or, jump to ending, variables, scoring, outcome quiz, URL parameters, recall `@` | Forward-only jumps with one condition per rule, overview list |
| Design | Gallery of 30 free themes + custom (colors, fonts, background image) | 3 colors + 4 fonts |
| Form settings | Display toggles, preferences, notifications, open/closed, language + system messages | None (theme and thank-you only) |
| Share | Page with link, QR, link preview, social, embed (6 modes), email embed | Modal with copy link |
| Results | Performance, summary, responses table, docked panel, download, test response | Old summary + table + drawer, CSV |
| Connect | 82-app catalog, webhooks, email notifications | "Soon" placeholders |
| AI | Create from prompt, Chat to create (review/apply), memory, workspace assistant | Backend create/append endpoints (uncommitted), no UI |
| Templates / import | Template gallery, import from Google Forms | "Import questions" (one short text per line) |
| Misc | Version history, accessibility checker, mobile preview | Mobile/desktop preview only |

## 12. Proposed decomposition (each slice = own spec → plan → build)
1. **Finish the redesign** (handoff plan): shared form header, Share page + publish celebration, Results rebuild,
   respondent view recording, error/empty states, workspace search and skeletons.
2. **Typeform AI with Gemini Flash-Lite**: start screen, Chat to create with review/apply, workspace assistant, memory.
3. **Content model v2 + 14 new question types** (the big one): blocks (welcome, questions, statements, groups, endings),
   a single type registry driving builder, respondent, validation, stats, export and the AI schema; change question type.
4. **Endings and screens**: multiple endings, welcome options, image/video attachments.
5. **Logic v2**: logic map, and/or, variables, scoring, outcome quiz, recall, URL parameters.
6. **Design v2**: the 30 free themes, custom themes, background images.
7. **Form settings and system messages**: display toggles, autosave/resume, free navigation, cookie consent, notifications,
   open/closed, editable system messages.
8. **Share and embed**: embed generator with a small SDK script, email embed, QR, social links.
9. **Templates and import**: original template gallery and "Use template".
10. **Connect**: integration catalog UI, real webhooks, real email notification; the rest "Soon".
Out of scope: accounts/auth, plans and billing, every paid feature above, Contacts, Automations, Insights, Pages, Research Flow.
