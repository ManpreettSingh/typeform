import type { AnswerValue, PublicQuestionOf } from "../types";

export const validateRanking = (question: PublicQuestionOf<"ranking">, value: AnswerValue): string | null => {
  if (!Array.isArray(value)) return "Answer must be a list of option IDs";
  const opts = new Set(question.properties.options.map(o => o.id));
  const vals = new Set(value);
  if (value.length !== opts.size || vals.size !== opts.size) {
    for (const v of value) {
      if (!opts.has(v)) return "Invalid options";
    }
    return "Please rank all options";
  }
  return null;
};

export const formatRanking = (question: PublicQuestionOf<"ranking">, value: AnswerValue): string => {
  if (!Array.isArray(value)) return "";
  const opts = Object.fromEntries(question.properties.options.map(o => [o.id, o.label]));
  return value.map(id => opts[id] || "(removed choice)").join(", ");
};

export const rankingToSubmission = (question: PublicQuestionOf<"ranking">, value: AnswerValue): AnswerValue => {
  if (!Array.isArray(value)) return [] as unknown as AnswerValue;
  return value as unknown as AnswerValue;
};

export const validateMatrix = (question: PublicQuestionOf<"matrix">, value: AnswerValue): string | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "Answer must be a dictionary";
  const rows = new Set(question.properties.rows.map(o => o.id));
  const cols = new Set(question.properties.columns.map(o => o.id));
  
  for (const [r, c] of Object.entries(value)) {
    if (!rows.has(r)) return `Invalid row: ${r}`;
    
    if (question.properties.multiple_selection) {
      const cArr = Array.isArray(c) ? c : [c];
      for (const col of cArr) {
        if (!cols.has(col)) return `Invalid column: ${col}`;
      }
    } else {
      if (Array.isArray(c)) {
        if (c.length > 1) return "Please choose one option per row";
        if (c.length > 0 && !cols.has(c[0])) return `Invalid column: ${c[0]}`;
      } else {
        if (!cols.has(c as string)) return `Invalid column: ${c}`;
      }
    }
  }
  return null;
};

export const formatMatrix = (question: PublicQuestionOf<"matrix">, value: AnswerValue): string => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return "";
  const rows = Object.fromEntries(question.properties.rows.map(o => [o.id, o.label]));
  const cols = Object.fromEntries(question.properties.columns.map(o => [o.id, o.label]));
  
  const parts = [];
  for (const [r, c] of Object.entries(value)) {
    const rLabel = rows[r] || "(removed row)";
    let cLabel = "";
    if (Array.isArray(c)) {
      cLabel = c.map(colId => cols[colId] || "(removed choice)").join(", ");
    } else {
      cLabel = cols[c as string] || "(removed choice)";
    }
    parts.push(`${rLabel}: ${cLabel}`);
  }
  return parts.join(" | ");
};

export const matrixToSubmission = (question: PublicQuestionOf<"matrix">, value: AnswerValue): AnswerValue => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {} as AnswerValue;
  const out: Record<string, string | string[]> = {};
  for (const [r, c] of Object.entries(value)) {
    if (question.properties.multiple_selection) {
      out[r] = Array.isArray(c) ? c : [c as string];
    } else {
      if (Array.isArray(c)) {
        if (c.length > 0) out[r] = c[0];
      } else {
        out[r] = c as string;
      }
    }
  }
  return out as unknown as AnswerValue;
};
