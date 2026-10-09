// Date answers: stored as "YYYY-MM-DD", shown in the question's own format and separator. Mirrors
// backend/app/question_types/dates.py (the server stays authoritative).
import type { DateProperties } from "@/lib/types";

// Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
export const DATE_INVALID = "That date doesn't look valid—it's incomplete or doesn't exist";
export const DATE_REVERSED = "That date isn't valid. Check the month and day aren't reversed.";

const STORED = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;

const isLeap = (year: number) => (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
const daysIn = (year: number, month: number) =>
  [31, isLeap(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];

function exists(year: number, month: number, day: number): boolean {
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysIn(year, month);
}

type Parts = { year: number; month: number; day: number };

function parseStored(value: unknown): Parts | null {
  const match = typeof value === "string" ? STORED.exec(value.trim()) : null;
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

/** A real date from "YYYY-MM-DD"; null for anything else (including dates that don't exist). */
export function parseDate(value: unknown): Parts | null {
  const parts = parseStored(value);
  return parts && exists(parts.year, parts.month, parts.day) ? parts : null;
}

/** A sortable number for comparing dates; null when the value isn't a real date. */
export function dateKey(value: unknown): number | null {
  const parts = parseDate(value);
  return parts ? parts.year * 10000 + parts.month * 100 + parts.day : null;
}

/** The date as the respondent sees it, e.g. 07.03.2026 for DDMMYYYY with ".". */
export function displayDate(parts: Parts, props: Pick<DateProperties, "format" | "separator">): string {
  const text = {
    MM: String(parts.month).padStart(2, "0"),
    DD: String(parts.day).padStart(2, "0"),
    YYYY: String(parts.year).padStart(4, "0"),
  };
  return (props.format.match(/MM|DD|YYYY/g) ?? []).map((token) => text[token as keyof typeof text]).join(props.separator);
}

/** Display text for a stored value; anything unreadable is shown as stored. */
export function formatDate(value: unknown, props: DateProperties): string {
  const parts = parseDate(value);
  return parts ? displayDate(parts, props) : String(value);
}

/** "Choose a date on or after 01/15/2026." and its siblings, or null when the question has no limits. */
export function dateRangeHint(props: DateProperties): string | null {
  const low = parseDate(props.start_date);
  const high = parseDate(props.end_date);
  if (low && high) return `Choose a date between ${displayDate(low, props)} and ${displayDate(high, props)}.`;
  if (low) return `Choose a date on or after ${displayDate(low, props)}.`;
  if (high) return `Choose a date on or before ${displayDate(high, props)}.`;
  return null;
}

export function validateDate(props: DateProperties, value: unknown): string | null {
  const stored = parseStored(value);
  if (!stored) return DATE_INVALID;
  const { year, month, day } = stored;
  if (!exists(year, month, day)) {
    // 13/01 typed into MM/DD: the day and month are probably swapped.
    return month > 12 && day >= 1 && day <= 12 && exists(year, day, month) ? DATE_REVERSED : DATE_INVALID;
  }
  const key = year * 10000 + month * 100 + day;
  const low = dateKey(props.start_date);
  const high = dateKey(props.end_date);
  if ((low !== null && key < low) || (high !== null && key > high)) return dateRangeHint(props);
  return null;
}
