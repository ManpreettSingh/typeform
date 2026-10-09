// URL parameters ("Pull data in"): the respondent's link can carry values the form declared, in the query string
// (?email=a@b.co) or the hash (#email=a@b.co). Values are plain text, cut to the server's limit.

/** Same limit as the server (`responses.params`): characters per value. */
export const PARAM_MAX_LENGTH = 500;

type LocationParts = { search?: string; hash?: string };

const entriesOf = (raw: string | undefined, leading: "?" | "#"): [string, string][] => {
  if (!raw) return [];
  const text = raw.startsWith(leading) ? raw.slice(1) : raw;
  return [...new URLSearchParams(text).entries()];
};

/**
 * The declared parameters present in the link: only names in `declared` (exact spelling), values cut to 500
 * characters, empty ones dropped. When a name is in both places the query string wins.
 */
export function readUrlParams(declared: readonly string[], { search, hash }: LocationParts): Record<string, string> {
  const names = new Set(declared);
  const found = new Map<string, string>();
  for (const [name, value] of [...entriesOf(search, "?"), ...entriesOf(hash, "#")]) {
    if (!names.has(name) || found.has(name)) continue;
    const text = Array.from(value).slice(0, PARAM_MAX_LENGTH).join("");
    if (text) found.set(name, text);
  }
  return Object.fromEntries(found);
}

/** `readUrlParams` for the page being viewed (browser only). */
export function readLocationParams(declared: readonly string[]): Record<string, string> {
  if (typeof window === "undefined" || declared.length === 0) return {};
  return readUrlParams(declared, window.location);
}
