// Contacts: the pure parts. Labels, the filter model (mirrors backend/app/schemas/contact.py), and reading a CSV file
// into contacts in the browser. The server re-checks everything; nothing here is trusted.

// ---- shapes ----------------------------------------------------------------------------------------------------------

export type SubscriptionStatus = "subscribed" | "unsubscribed" | "never_subscribed" | "suppressed";
/** The statuses a person can choose; Typeform sets "suppressed" itself. */
export const SELECTABLE_STATUSES: Exclude<SubscriptionStatus, "suppressed">[] = ["subscribed", "unsubscribed", "never_subscribed"];

export const SUBSCRIPTION_LABELS: Record<SubscriptionStatus, string> = {
  subscribed: "Subscribed",
  unsubscribed: "Unsubscribed",
  never_subscribed: "Never subscribed",
  suppressed: "Suppressed",
};

export type ContactSource = { type: "manual" | "csv_import" | "form"; form_id?: number; form_title?: string | null };

export const LAST_UPDATE_SOURCE_LABELS: Record<string, string> = {
  sync: "Sync",
  csv_import: "CSV import",
  manual_edit: "Manual edit",
};

/** What the frozen Contact column shows: the name, else the email. */
export function contactLabel({ name, email }: { name: string | null; email: string | null }): string {
  return name || email || "Unnamed contact";
}

export function sourceLabel(source: ContactSource): string {
  if (source.type === "form") return source.form_title || "A deleted form";
  return source.type === "csv_import" ? "CSV import" : "Manual edit";
}

// ---- filters ---------------------------------------------------------------------------------------------------------

export type FilterProperty = "name" | "email" | "phone" | "company" | "notes" | "subscription_status" | "last_change";
export type FilterOperator = "and" | "or";
export type FilterCondition = { property: FilterProperty; op: string; value: string };
export type ApiFilters = {
  operator: FilterOperator;
  conditions: { property: FilterProperty; op: string; value: string | null }[];
};

type Op = { value: string; label: string; needsValue: boolean };

const TEXT_OPS: Op[] = [
  { value: "contains", label: "Contains", needsValue: true },
  { value: "not_contains", label: "Does not contain", needsValue: true },
  { value: "is_empty", label: "Is empty", needsValue: false },
  { value: "is_not_empty", label: "Is not empty", needsValue: false },
];
const STATUS_OPS: Op[] = [
  { value: "is", label: "Is", needsValue: true },
  { value: "is_not", label: "Is not", needsValue: true },
];
const DATE_OPS: Op[] = [
  { value: "before", label: "Is before", needsValue: true },
  { value: "after", label: "Is after", needsValue: true },
];

export const FILTER_PROPERTIES: { value: FilterProperty; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "notes", label: "Notes" },
  { value: "subscription_status", label: "Subscription status" },
  { value: "last_change", label: "Last change" },
];

export function opsFor(property: FilterProperty): Op[] {
  if (property === "subscription_status") return STATUS_OPS;
  return property === "last_change" ? DATE_OPS : TEXT_OPS;
}

export const defaultCondition = (): FilterCondition => ({ property: "name", op: "contains", value: "" });

export function conditionIsComplete(condition: FilterCondition): boolean {
  const op = opsFor(condition.property).find((o) => o.value === condition.op);
  return Boolean(op) && (!op!.needsValue || condition.value.trim() !== "");
}

/** The filters as the API takes them, or null when no condition is filled in yet. */
export function toApiFilters(operator: FilterOperator, conditions: FilterCondition[]): ApiFilters | null {
  const complete = conditions.filter(conditionIsComplete);
  if (complete.length === 0) return null;
  return {
    operator,
    conditions: complete.map((c) => ({
      property: c.property,
      op: c.op,
      value: opsFor(c.property).find((o) => o.value === c.op)?.needsValue ? c.value.trim() : null,
    })),
  };
}

// ---- CSV import ------------------------------------------------------------------------------------------------------

export type ImportProperty = "ignore" | "email" | "name" | "first_name" | "last_name" | "phone" | "company" | "notes" | "subscription_status";

export const IMPORT_PROPERTIES: { value: ImportProperty; label: string }[] = [
  { value: "ignore", label: "Don't import" },
  { value: "email", label: "Email" },
  { value: "name", label: "Name" },
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "notes", label: "Notes" },
  { value: "subscription_status", label: "Subscription status" },
];

/** Where the file's first line says the cells end: whichever of , ; tab appears most outside quotes. */
function detectDelimiter(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === "\n" || char === "\r")) break;
    else if (!quoted && char in counts) counts[char] += 1;
  }
  const [best, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return count === 0 ? "," : best;
}

/** A CSV file as rows of cells: quoted cells, doubled quotes and line breaks inside quotes; blank rows dropped. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  const endRow = () => {
    row.push(cell);
    cell = "";
    if (row.some((c) => c.trim() !== "")) rows.push(row);
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === delimiter) {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      endRow();
    } else cell += char;
  }
  endRow();
  return rows;
}

const HEADERS: Record<Exclude<ImportProperty, "ignore">, string[]> = {
  email: ["email", "emailaddress", "mail", "emailid"],
  name: ["name", "fullname", "contactname", "contact", "customername"],
  first_name: ["firstname", "first", "givenname", "forename"],
  last_name: ["lastname", "last", "surname", "familyname"],
  phone: ["phone", "phonenumber", "mobile", "mobilephone", "tel", "telephone", "cell"],
  company: ["company", "companyname", "organization", "organisation", "employer", "business"],
  notes: ["notes", "note", "comments", "comment", "description"],
  subscription_status: ["subscriptionstatus", "subscription", "subscribed", "optin"],
};

/** The most likely property for each column, from its header. A property goes to one column only (the first). */
export function guessMapping(headers: string[]): ImportProperty[] {
  const taken = new Set<ImportProperty>();
  return headers.map((header) => {
    const key = header.toLowerCase().replace(/[^a-z0-9]/g, "");
    const match = (Object.entries(HEADERS) as [ImportProperty, string[]][]).find(([prop, names]) => !taken.has(prop) && names.includes(key));
    if (!match) return "ignore";
    taken.add(match[0]);
    return match[0];
  });
}

/** The import rows for the API: the mapped columns of every line after the header, empty cells left out. */
export function buildImportRows(table: string[][], mapping: ImportProperty[]): Record<string, string>[] {
  return table.slice(1).map((cells) => {
    const row: Record<string, string> = {};
    mapping.forEach((property, column) => {
      const value = (cells[column] ?? "").trim();
      if (property !== "ignore" && value) row[property] = value;
    });
    if (!row.name) {
      const joined = [row.first_name, row.last_name].filter(Boolean).join(" ");
      if (joined) row.name = joined;
    }
    delete row.first_name;
    delete row.last_name;
    return row;
  });
}
