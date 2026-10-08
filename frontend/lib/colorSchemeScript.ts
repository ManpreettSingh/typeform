// Server-safe part of lib/colorScheme.ts: rendered inline by app/layout.tsx.

export const COLOR_SCHEME_STORAGE_KEY = "color-scheme";

/**
 * Runs inline in <head> before first paint, so a dark preference never flashes light.
 * Mirrors `resolve` in lib/colorScheme.ts: stored "light"/"dark", otherwise the OS setting.
 */
export const COLOR_SCHEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(
  COLOR_SCHEME_STORAGE_KEY,
)});var d=p==="dark"||(p!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.setAttribute("data-theme",d?"dark":"light")}catch(e){}})()`;
