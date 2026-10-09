import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_EMBED_OPTIONS,
  EMBED_MODES,
  emailEmbedSnippet,
  embedFormUrl,
  embedQuery,
  embedSnippet,
  normalizeEmbedOptions,
  parseEmbedParams,
  previewDocument,
  readableTextColor,
  sdkScriptTag,
  withMode,
  type EmbedOptions,
} from "./shareEmbed";

const ORIGIN = "https://forms.example.com";
const SLUG = "abc123";
const opts = (patch: Partial<EmbedOptions> = {}): EmbedOptions => normalizeEmbedOptions({ ...DEFAULT_EMBED_OPTIONS, ...patch });
const snippet = (patch: Partial<EmbedOptions> = {}) => embedSnippet(opts(patch), { origin: ORIGIN, slug: SLUG });

describe("embed modes", () => {
  it("lists the six modes of Typeform's picker in order", () => {
    assert.deepEqual(
      EMBED_MODES.map((m) => m.label),
      ["Standard", "Full-page", "Popup", "Slider", "Popover", "Side tab"],
    );
    assert.deepEqual(
      EMBED_MODES.map((m) => m.value),
      ["standard", "fullpage", "popup", "slider", "popover", "sidetab"],
    );
  });

  it("switching mode resets 'full-screen on mobile' to that mode's default (off inline, on for overlays)", () => {
    assert.equal(withMode(opts(), "standard").fullscreenMobile, false);
    assert.equal(withMode(opts(), "popup").fullscreenMobile, true);
    assert.equal(withMode(opts({ fullscreenMobile: true }), "standard").fullscreenMobile, false);
    assert.equal(withMode(opts(), "slider").mode, "slider");
  });
});

describe("normalizeEmbedOptions", () => {
  it("clamps numbers into their allowed ranges and rounds them", () => {
    const o = normalizeEmbedOptions({ width: 400, height: 10, opacity: -5, size: 5, sliderWidth: 99999, delay: 999, closeDelay: -1 });
    assert.equal(o.width, 100);
    assert.equal(o.height, 200);
    assert.equal(o.opacity, 0);
    assert.equal(o.size, 40);
    assert.equal(o.sliderWidth, 1200);
    assert.equal(o.delay, 60);
    assert.equal(o.closeDelay, 0);
    assert.equal(normalizeEmbedOptions({ height: 480.6 }).height, 481);
  });

  it("falls back to defaults for unknown modes, positions, triggers and bad colors", () => {
    const o = normalizeEmbedOptions({
      mode: "nope" as never,
      position: "top" as never,
      trigger: "hover" as never,
      buttonColor: "red",
    });
    assert.equal(o.mode, "standard");
    assert.equal(o.position, "right");
    assert.equal(o.trigger, "click");
    assert.equal(o.buttonColor, DEFAULT_EMBED_OPTIONS.buttonColor);
  });

  it("keeps button text non-empty and short", () => {
    assert.equal(normalizeEmbedOptions({ buttonText: "   " }).buttonText, DEFAULT_EMBED_OPTIONS.buttonText);
    assert.equal(normalizeEmbedOptions({ buttonText: "x".repeat(100) }).buttonText.length, 40);
  });
});

describe("embedQuery / embedFormUrl / parseEmbedParams", () => {
  it("builds the iframe URL with only the options that differ from the defaults", () => {
    assert.equal(embedQuery({ mode: "standard", hideHeaders: false, opacity: 100 }), "embed=standard");
    assert.equal(embedQuery({ mode: "popup", hideHeaders: true, opacity: 60 }), "embed=popup&hideHeaders=1&opacity=60");
    assert.equal(
      embedFormUrl(ORIGIN, "a b", { mode: "slider", hideHeaders: false, opacity: 100 }),
      `${ORIGIN}/f/a%20b?embed=slider`,
    );
  });

  it("parses what embedQuery wrote, for every mode", () => {
    for (const { value } of EMBED_MODES) {
      const q = embedQuery({ mode: value, hideHeaders: true, opacity: 35 });
      assert.deepEqual(parseEmbedParams(q), { mode: value, hideHeaders: true, opacity: 35 });
    }
  });

  it("returns null when the page isn't embedded (no or unknown embed mode)", () => {
    assert.equal(parseEmbedParams(""), null);
    assert.equal(parseEmbedParams("hideHeaders=1"), null);
    assert.equal(parseEmbedParams("embed=bogus"), null);
  });

  it("applies the defaults: headers shown, fully opaque", () => {
    assert.deepEqual(parseEmbedParams("embed=fullpage"), { mode: "fullpage", hideHeaders: false, opacity: 100 });
  });

  it("treats transparent=1 as opacity 0 unless an explicit opacity is given", () => {
    assert.equal(parseEmbedParams("embed=popup&transparent=1")?.opacity, 0);
    assert.equal(parseEmbedParams("embed=popup&transparent=1&opacity=40")?.opacity, 40);
    assert.equal(parseEmbedParams("embed=popup&transparent=0")?.opacity, 100);
  });

  it("clamps and sanitizes opacity", () => {
    assert.equal(parseEmbedParams("embed=popup&opacity=250")?.opacity, 100);
    assert.equal(parseEmbedParams("embed=popup&opacity=-3")?.opacity, 0);
    assert.equal(parseEmbedParams("embed=popup&opacity=abc")?.opacity, 100);
  });

  it("accepts URLSearchParams and objects with get()", () => {
    assert.equal(parseEmbedParams(new URLSearchParams("embed=sidetab"))?.mode, "sidetab");
    const bag = { get: (k: string) => (k === "embed" ? "popover" : null) };
    assert.equal(parseEmbedParams(bag)?.mode, "popover");
  });

  it("accepts the 'true' spelling for hideHeaders", () => {
    assert.equal(parseEmbedParams("embed=standard&hideHeaders=true")?.hideHeaders, true);
    assert.equal(parseEmbedParams("embed=standard&hideHeaders=0")?.hideHeaders, false);
  });
});

describe("embedSnippet", () => {
  it("standard: a div with width in % and height in px, then the SDK script", () => {
    assert.equal(
      snippet({ mode: "standard", width: 80, height: 640 }),
      `<div data-typeform-embed="standard" data-slug="abc123" data-width="80%" data-height="640px"></div>\n` +
        `<script src="${ORIGIN}/embed.js" async></script>`,
    );
  });

  it("full-page: no size attributes", () => {
    const s = snippet({ mode: "fullpage" });
    assert.ok(s.startsWith(`<div data-typeform-embed="fullpage" data-slug="abc123"></div>`));
    assert.ok(!s.includes("data-width") && !s.includes("data-height"));
  });

  it("adds hide-headers, background opacity and fullscreen only when they differ from the defaults", () => {
    const plain = snippet({ mode: "standard" });
    assert.ok(!/data-hide-headers|data-opacity|data-fullscreen-mobile/.test(plain));
    const custom = snippet({ mode: "standard", hideHeaders: true, opacity: 50, fullscreenMobile: true });
    assert.ok(custom.includes('data-hide-headers="true"'));
    assert.ok(custom.includes('data-opacity="50"'));
    assert.ok(custom.includes('data-fullscreen-mobile="true"'));
    // Overlay modes default to full-screen on mobile, so only "off" is written.
    assert.ok(!snippet({ mode: "popup" }).includes("data-fullscreen-mobile"));
    assert.ok(snippet({ mode: "popup", fullscreenMobile: false }).includes('data-fullscreen-mobile="false"'));
  });

  it("popup with a button trigger: a styled button carrying the label and colour", () => {
    const s = snippet({ mode: "popup", size: 70, buttonText: "Take the survey", buttonColor: "#177767" });
    assert.ok(s.startsWith(`<button type="button" data-typeform-embed="popup" data-slug="abc123" data-size="70"`));
    assert.ok(s.includes("background:#177767"));
    assert.ok(s.includes("color:#ffffff"));
    assert.ok(s.includes(">Take the survey</button>"));
  });

  it("uses dark text on light button colors", () => {
    assert.equal(readableTextColor("#ffffff"), "#2a222b");
    assert.equal(readableTextColor("#fbe19d"), "#2a222b");
    assert.equal(readableTextColor("#3c323e"), "#ffffff");
  });

  it("auto-open trigger: an invisible div with open=load and the delay, no button", () => {
    const s = snippet({ mode: "popup", trigger: "load", delay: 8 });
    assert.ok(s.startsWith(`<div data-typeform-embed="popup" data-slug="abc123"`));
    assert.ok(s.includes('data-open="load"') && s.includes('data-delay="8"'));
    assert.ok(!s.includes("<button"));
  });

  it("slider: position and width in px", () => {
    const s = snippet({ mode: "slider", position: "left", sliderWidth: 700 });
    assert.ok(s.includes('data-position="left"') && s.includes('data-width="700px"'));
  });

  it("popover and side tab: launcher text and colour on a placeholder div", () => {
    for (const mode of ["popover", "sidetab"] as const) {
      const s = snippet({ mode, buttonText: "Chat with us", buttonColor: "#0a66c2" });
      assert.ok(s.startsWith(`<div data-typeform-embed="${mode}" data-slug="abc123"`), mode);
      assert.ok(s.includes('data-button-text="Chat with us"') && s.includes('data-button-color="#0a66c2"'), mode);
    }
  });

  it("popover and side tab can also open automatically", () => {
    const s = snippet({ mode: "popover", trigger: "load", delay: 3 });
    assert.ok(s.includes('data-open="load"') && s.includes('data-delay="3"'));
  });

  it("close after submit writes the delay in seconds, only for modes that open and close", () => {
    assert.ok(snippet({ mode: "popup", closeOnSubmit: true, closeDelay: 4 }).includes('data-auto-close="4"'));
    assert.ok(!snippet({ mode: "popup", closeOnSubmit: false }).includes("data-auto-close"));
    assert.ok(!snippet({ mode: "standard", closeOnSubmit: true }).includes("data-auto-close"));
  });

  it("escapes HTML in the slug and the button text", () => {
    const s = embedSnippet(opts({ mode: "popup", buttonText: `<b>"hi" & bye</b>` }), { origin: ORIGIN, slug: `a"b` });
    assert.ok(s.includes('data-slug="a&quot;b"'));
    assert.ok(s.includes("&lt;b&gt;&quot;hi&quot; &amp; bye&lt;/b&gt;</button>"));
    assert.ok(!s.includes("<b>"));
  });

  it("adds the embed name as an HTML comment (escaped) when there is one", () => {
    const s = snippet({ name: "Landing --> page" });
    assert.ok(s.startsWith("<!-- Landing --&gt; page -->\n"));
    assert.ok(!snippet({ name: "  " }).includes("<!--"));
  });

  it("points the script at the given origin, without a trailing slash problem", () => {
    assert.ok(embedSnippet(opts(), { origin: `${ORIGIN}/`, slug: SLUG }).includes(`src="${ORIGIN}/embed.js"`));
    assert.equal(sdkScriptTag(ORIGIN), `<script src="${ORIGIN}/embed.js" async></script>`);
  });
});

describe("emailEmbedSnippet", () => {
  const email = emailEmbedSnippet({
    url: `${ORIGIN}/f/${SLUG}`,
    headline: "We'd love your <feedback>",
    description: "It takes 2 minutes.",
    buttonText: "Start",
    buttonColor: "#3c323e",
  });

  it("is a table-based block with inline styles (what email clients support), no scripts", () => {
    assert.ok(email.startsWith("<table"));
    assert.ok(email.includes('role="presentation"'));
    assert.ok(!/<script|<style|<link/i.test(email));
  });

  it("links the button to the form and escapes the text", () => {
    assert.ok(email.includes(`href="${ORIGIN}/f/${SLUG}"`));
    assert.ok(email.includes(">Start</a>"));
    assert.ok(email.includes("We&#39;d love your &lt;feedback&gt;"));
    assert.ok(email.includes("It takes 2 minutes."));
  });

  it("leaves out an empty description", () => {
    const s = emailEmbedSnippet({ url: "https://x.test/f/a", headline: "Hi", description: "", buttonText: "Go", buttonColor: "#3c323e" });
    assert.ok(!s.includes("<p"));
  });
});

describe("previewDocument", () => {
  it("wraps the snippet in a mock host page that loads the same embed.js", () => {
    const s = embedSnippet(opts({ mode: "popover" }), { origin: ORIGIN, slug: SLUG });
    const doc = previewDocument(s);
    assert.ok(doc.startsWith("<!doctype html>"));
    assert.ok(doc.includes(s));
    assert.ok(doc.includes('<meta name="viewport"'));
  });
});
