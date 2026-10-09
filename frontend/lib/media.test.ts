import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { imageFilter, imagePosition, layoutFor } from "./media";

describe("layoutFor", () => {
  const media = {
    layout: { type: "split" as const, placement: "right" as const },
    viewport_overrides: { small: { type: "wallpaper" as const } },
  };

  it("uses the desktop layout on large screens and the mobile one on small", () => {
    assert.deepEqual(layoutFor(media, false), { type: "split", placement: "right" });
    assert.deepEqual(layoutFor(media, true), { type: "wallpaper", placement: "left" });
  });

  it("defaults to stack on both, and float/split to the image on the left", () => {
    assert.deepEqual(layoutFor({}, false), { type: "stack", placement: "left" });
    assert.deepEqual(layoutFor({ layout: { type: "split" } }, true), { type: "stack", placement: "left" });
    assert.deepEqual(layoutFor({ layout: { type: "float", placement: null } }, false), { type: "float", placement: "left" });
  });
});

describe("imageFilter", () => {
  it("follows Typeform: darker is brightness only, lighter also lowers contrast", () => {
    assert.equal(imageFilter(0), undefined);
    assert.equal(imageFilter(null), undefined);
    assert.equal(imageFilter(-50), "brightness(0.5)");
    assert.equal(imageFilter(50), "contrast(0.5) brightness(1.5)");
    assert.equal(imageFilter(-100), "brightness(0)");
  });
});

describe("imagePosition", () => {
  it("turns the focal point into an object-position, centred by default", () => {
    assert.equal(imagePosition(null), "50% 50%");
    assert.equal(imagePosition({ x: 0.25, y: 1 }), "25% 100%");
  });
});
