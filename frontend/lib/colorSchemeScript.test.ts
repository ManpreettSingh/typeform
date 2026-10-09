import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COLOR_SCHEME_SCRIPT, COLOR_SCHEME_STORAGE_KEY } from "./colorSchemeScript";

/** Runs the inline <head> script against a fake browser and returns the data-theme it sets. */
function themeFor(stored: string | null, osIsDark: boolean): string | undefined {
  let theme: string | undefined;
  const localStorage = { getItem: (key: string) => (key === COLOR_SCHEME_STORAGE_KEY ? stored : null) };
  const matchMedia = () => ({ matches: osIsDark });
  const document = { documentElement: { setAttribute: (_: string, value: string) => (theme = value) } };
  new Function("localStorage", "matchMedia", "document", COLOR_SCHEME_SCRIPT)(localStorage, matchMedia, document);
  return theme;
}

describe("the creator UI's first-paint theme", () => {
  it("is light by default, even when the computer is set to dark", () => {
    assert.equal(themeFor(null, true), "light");
    assert.equal(themeFor(null, false), "light");
  });

  it("keeps a chosen Light or Dark", () => {
    assert.equal(themeFor("light", true), "light");
    assert.equal(themeFor("dark", false), "dark");
  });

  it("follows the computer only when System was chosen", () => {
    assert.equal(themeFor("system", true), "dark");
    assert.equal(themeFor("system", false), "light");
  });

  it("ignores an unknown stored value", () => {
    assert.equal(themeFor("purple", true), "light");
  });
});
