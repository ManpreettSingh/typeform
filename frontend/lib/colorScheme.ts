"use client";

// Light / dark / system preference for the creator UI. The choice lives in localStorage; the resolved theme is
// the `data-theme` attribute on <html> that globals.css keys the dark tokens on.
import { useSyncExternalStore } from "react";
import { COLOR_SCHEME_STORAGE_KEY } from "./colorSchemeScript";

export type ColorSchemePreference = "light" | "dark" | "system";
export type ColorScheme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";
const listeners = new Set<() => void>();

function readPreference(): ColorSchemePreference {
  try {
    const stored = localStorage.getItem(COLOR_SCHEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : "system";
  } catch {
    return "system";
  }
}

/** Keep in sync with COLOR_SCHEME_SCRIPT. */
function resolve(preference: ColorSchemePreference): ColorScheme {
  if (preference !== "system") return preference;
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

function apply() {
  document.documentElement.setAttribute("data-theme", resolve(readPreference()));
  listeners.forEach((listener) => listener());
}

export function setColorSchemePreference(preference: ColorSchemePreference) {
  try {
    if (preference === "system") localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY);
    else localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, preference);
  } catch {
    // Storage blocked: still switch for this page view.
  }
  apply();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const media = matchMedia(DARK_QUERY);
  // Follow the OS while on "system"; also pick up a change made in another tab.
  const onStorage = (e: StorageEvent) => e.key === COLOR_SCHEME_STORAGE_KEY && apply();
  media.addEventListener("change", apply);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    media.removeEventListener("change", apply);
    window.removeEventListener("storage", onStorage);
  };
}

/** The stored preference ("system" on the server and before hydration). */
export function useColorSchemePreference(): ColorSchemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => "system");
}

/** The theme actually shown. */
export function useColorScheme(): ColorScheme {
  return useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light"),
    () => "light",
  );
}
