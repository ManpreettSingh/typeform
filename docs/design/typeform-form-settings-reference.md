# Typeform "Form settings" dialog (measured 2026-10-09, Free plan, scratch draft DaXKht1o, nothing saved)

Opened with the gear icon in the builder toolbar (URL `?modal=settings&modal-section=general`). Sections in the left nav:
**General · Access & Scheduling · Language · Block references** (the last is disabled/greyed on an empty reference list).

## Dialog metrics
Modal 960 × 584, radius 16, background `#f7f7f8`, ring `0 0 0 3px rgba(84,80,88,.09)`. Title "Form settings" (21px). Left nav
items 40px tall, 14px, active item bg `rgba(87,84,91,.06)`. Right pane scrolls; footer "Cancel" (ghost) / "Save" (primary,
disabled until something changes). Section titles are 14px/500; switch rows ~40px with the switch on the right; the paid items show a
small green diamond badge next to the label (we render those rows disabled with a "Soon" badge).

## General
- **Form mode**: "Modes give you the right tools for your form, so you can create and publish faster." Dropdown "Choose a mode" =
  Universal. Hint "Switching modes might result in changes to form settings." (we keep Universal only; disabled select).
- **Display** (switch, default): Typeform branding (ON, paid to turn off → disabled) · Navigation arrows (ON) · Progress bar (ON) ·
  Question number (ON) · Asterisks (*) to show required questions (ON) · Letters on answers (ON).
- **Preferences**: Autosave progress (ON) · Free form navigation (off) · Cookie consent (off) · Enrich form responses (paid) ·
  Capture partial responses after every question (paid) · Spam prevention (paid) · Duplicate response prevention (paid).
- **Notifications**: Send email for new responses (off) · Send email when form is signed (paid) · "Send email to" + "Add email" button.

## Access & Scheduling
Banner "Your typeform is open to new responses." then switches: **Open this form to new responses** (ON, free) · Schedule a close date
(paid) · Set a response limit (paid) · Show custom closed message (paid). When closed the banner reads that the form is closed and
respondents see the closed message.

## Language
"Form Languages": Main language = English (select) · Translations ("Translate this form by uploading your own translations, or with the
help of AI." + "Go to Translations", paid → disabled). Then **System messages**, in groups, each with a "Reset all" link and, per
message, a label, an input showing the default text and a counter `n / max`. `{token}` parts are variable pills (not editable text).

Key (ours) · label · default · max:

**Buttons, hints, and shortcuts**
| key | label | default | max |
|---|---|---|---|
| ok_button | Button to confirm answer | OK | 100 |
| next_hint | Keyboard instruction to go to next question | press Enter ↵ | 200 |
| multi_select_hint | Hint for multiple selection | Choose as many as you like | 165 |
| dropdown_hint | Instruction for Dropdown question | Type or select an option | 100 |
| dropdown_hint_touch | Instruction for Dropdown question on touch screens | Select an option | 100 |
| none_of_the_above | Label for "None of the above" answer option | None of the above | 100 |
| other | Label for "Other" answer option | Other | 100 |
| other_hint | Hint for adding text for "Other" answer option | Type your answer | 100 |
| select_exact_1 | Multiple selection: exact number option (step 1) | Choose {min_selection} | 100 |
| select_exact_2 | Multiple selection: exact number option (step 2) | Choose {additional_selections} more | 100 |
| select_max_1 | Multiple selection: only max set (step 1) | You can choose up to {max_selection} | 100 |
| select_max_2 | Multiple selection: only max set (step 2) | You can choose {additional_selections} more | 100 |
| select_range | Multiple selection: min and max limits | Make between {min_selection} and {max_selection} choices | 100 |
| select_min_1 | Multiple selection: only min set | Choose at least {min_selection} | 100 |
| select_min_2 | Multiple selection: range set | Choose at least {additional_selections} more | 100 |
| text_hint | Hint for adding text | Type your answer here... | 100 |
| key_hint | Keyboard hint when respondent hovers over options | Key | 100 |
| yes | Button to respond "Yes" | Yes | 255 |
| no | Button to respond "No" | No | 255 |
| yes_key | Keyboard shortcut for "Yes" option | Y | 1 |
| no_key | Keyboard shortcut for "No" option | N | 1 |
| legal_accept | Button to accept statement in a Legal question | I accept | 255 |
| legal_reject | Button to reject statement in a Legal question | I don’t accept | 255 |
| review_button | Button to revise errors when respondent submits | Review | 100 |
| submit_button | Button to send typeform | Submit | 100 |
| quiz_continue | Button to move to the next question in the Knowledge quiz | Continue | 100 |

**Error messages**
| key | label | default | max |
|---|---|---|---|
| err_required | If an answer is required | Please fill this in | 64 |
| err_required_field | …(includes field name) | Please fill in {field_title} | 64 |
| err_selection | If an answer requires a selection | Oops! Please make a selection | 386 |
| err_selection_field | …(includes field name) | Please make a selection in {field_title} | 386 |
| err_value | If a value is required | Oops! Please enter a value | 255 |
| err_value_field | …(includes field name) | Please enter a value in {field_title} | 255 |
| err_legal | If a legal statement is rejected | Please agree to the terms & conditions | 250 |
| err_email | If an email address is incorrect | Hmm... that email doesn't look right | 216 |
| err_url | If a URL is incorrect | Hmm… that web address doesn’t look right. Check for any typos or errors. | 163 |
| err_number_range | If number exceeds set min and max limits | Please enter a number between {min_value} and {max_value} | 64 |
| err_number_min | If the number entered is too low | Please enter a number greater than {min_value} | 147 |
| err_number_max | If the number entered is too high | Please enter a number lower than {max_value} | 64 |
| err_dropdown_none | If respondent's suggestion isn't found in Dropdown | No suggestions found | 64 |
| err_phone | If a phone number is not valid | Hmm... that phone number doesn't look right | 200 |
| err_date_min | If the entered date is before the minimum date | Choose a date on or after {date_min}. | 255 |
| err_date_max | If the entered date is after the maximum date | Choose a date on or before {date_max}. | 255 |
| err_date_range | If the entered date is outside the allowed range | Choose a date between {date_min} and {date_max}. | 255 |
| err_date_invalid | If the entered date is not valid | That date doesn't look valid—it's incomplete or doesn't exist | 255 |
| err_date_blocked | If the entered date is blocked | That date isn't valid. Check the month and day aren't reversed. | 255 |

**Loading & completing a typeform**
| key | label | default | max |
|---|---|---|---|
| done_message | Confirmation that typeform was sent | All done! Thanks for your time. | 1099 |
| err_connection | Error if there's no connection with the server | Oh no, you can’t connect to the server right now | 128 |
| err_server | Error if there's a problem with the server | Server error! Your request wasn't completed | 128 |
| err_unavailable | Error if there's a problem showing a typeform | The typeform {name}, is currently unavailable. Please try again in a few moments. | 128 |

**Other**
| key | label | default | max |
|---|---|---|---|
| unsupported_browser | Alert if device/browser isn't supported (read-only text, no counter) | You're viewing this typeform in "simple" mode. This is because your device is not yet supported by Typeform. | – |
| line_break_hint | Hint for making a line break in Long Text questions | Shift ⇧ + Enter ↵ to make a line break | 128 |

**File upload** (paid question type, skip) · **Date range hints**
| key | label | default | max |
|---|---|---|---|
| date_hint_min | Hint when only a minimum date is set | Choose a date on or after {date_min}. | 255 |
| date_hint_max | Hint when only a maximum date is set | Choose a date on or before {date_max}. | 255 |
| date_hint_range | Hint when both minimum and maximum dates are set | Choose a date between {date_min} and {date_max}. | 255 |
| date_closed | Notice when the date range has already closed | This date range is closed. It closed on {date_max}. | 255 |
