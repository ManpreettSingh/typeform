// Server-safe part of the first-visit intro: rendered inline by app/layout.tsx so a new visitor never sees the
// dashboard flash by before the intro covers it.
import { ONBOARDING_STORAGE_KEY } from "./onboarding";

/** Set on <html> while the intro is about to appear; app/globals.css keeps the workspace shell hidden meanwhile. */
export const ONBOARDING_PENDING_ATTRIBUTE = "data-onboarding";

/**
 * Runs inline in <head> before first paint, as `COLOR_SCHEME_SCRIPT` does for dark mode. It repeats the verdict of
 * `parseOnboarding` (lib/onboarding.ts): unseen unless storage holds a finished or skipped intro. If the page never
 * hydrates, the attribute goes away after 5 s, so a broken bundle can't leave a blank screen.
 */
export const ONBOARDING_SCRIPT = `(function(){var seen=false;try{var o=JSON.parse(localStorage.getItem(${JSON.stringify(
  ONBOARDING_STORAGE_KEY,
)}));seen=!!o&&typeof o==="object"&&!Array.isArray(o)&&o.v===1&&(o.status==="skipped"||(o.status==="completed"&&typeof o.name==="string"&&o.name.trim()!==""))}catch(e){}if(!seen){var h=document.documentElement;h.setAttribute(${JSON.stringify(
  ONBOARDING_PENDING_ATTRIBUTE,
)},"unseen");setTimeout(function(){h.removeAttribute(${JSON.stringify(ONBOARDING_PENDING_ATTRIBUTE)})},5000)}})()`;

/** Whether the script marked this page load as heading for the intro. */
export function isOnboardingPending(): boolean {
  return typeof document !== "undefined" && document.documentElement.hasAttribute(ONBOARDING_PENDING_ATTRIBUTE);
}

/** The intro (or the dashboard, for a returning visitor) has taken over: stop holding the shell back. */
export function clearOnboardingPending(): void {
  if (typeof document !== "undefined") document.documentElement.removeAttribute(ONBOARDING_PENDING_ATTRIBUTE);
}
