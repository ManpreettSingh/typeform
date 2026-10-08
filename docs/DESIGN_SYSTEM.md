# Design System

> **Superseded (2026-10-09):** the current values are measured from real Typeform screens and live in the brand kit, `docs/design/brand-kit/` (`tokens.css` is the source of truth, mirrored in `frontend/app/globals.css`; open `index.html` for the visual book). The tables below are the original Phase 0 approximations, kept for history. Don't hardcode colors in components.

## Tokens (initial)
| Token | Value |
|---|---|
| `--bg` | #FFFFFF |
| `--bg-subtle` | #F5F5F5 |
| `--text` | #262627 |
| `--text-muted` | #6B6B6C |
| `--border` | #E5E5E5 |
| `--primary` (builder buttons) | #262627 (dark) |
| `--accent` (respondent default answer color) | #0445AF |
| `--danger` | #D93025 |
| Radius | 4px inputs / 8px cards / 8px respondent buttons (`--radius-resp-button`) / 999px pills |
| Font | Inter (fallback system-ui). Respondent title ~ 24–32px, answer text ~ 24px light |

## Motion (respondent)
- Question change: old slides up + fades (≈250ms), new slides in from below (≈350ms), ease-out cubic. Back = reverse direction.
- Progress bar: width animates 300ms.
- Buttons: subtle scale/opacity on hover. Respect `prefers-reduced-motion`.

## Screens & key UI notes
**Dashboard** — top bar with logo + "Create form" button; grid or list of form cards (title, status pill, response count, updated time, ⋯ menu: rename / duplicate / delete); empty state; modal for create/rename/delete confirm.

**Builder** — 3-pane layout: left = question list (numbered, type icon, drag handle, "+ Add" with type picker popover); center = live preview of the selected question (real respondent component); right = settings panel (title, description, required toggle, options editor, rating max). Top bar: form title (inline editable), tabs *Create | Results | Share* , Preview, Publish button, save status ("Saved").

**Respondent** — full viewport, one question centered, number + arrow ("1 →"), big title, helper text, input with bottom-border style, OK button + "press Enter ↵", multiple choice as lettered options (A, B, C…) with keyboard shortcuts, top progress bar, bottom-right up/down nav arrows. Welcome screen optional. Thank-you screen with message.

**Results** — tabs: Summary (cards per question with bar charts) | Responses (table; click row → drawer/modal with full response).

**Placeholders** — Logic, Integrations, Collaborate, Payment/File upload: "Coming soon" badge, disabled.

## Components to build once (components/ui)
Button, IconButton, Modal, Dropdown/Menu, Popover, Toggle, Input, Textarea, Badge, Tabs, Tooltip, Skeleton, EmptyState, ConfirmDialog.
