import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PARAM_MAX_LENGTH, readUrlParams } from "./params";

const declared = ["utm_source", "email", "first_name"];

describe("readUrlParams", () => {
  it("reads declared names from the query string", () => {
    assert.deepEqual(readUrlParams(declared, { search: "?utm_source=google&email=a%40b.co" }), {
      utm_source: "google",
      email: "a@b.co",
    });
  });

  it("reads declared names from the hash (#a=1&b=2)", () => {
    assert.deepEqual(readUrlParams(declared, { hash: "#first_name=Ann&utm_source=news%20letter" }), {
      first_name: "Ann",
      utm_source: "news letter",
    });
  });

  it("accepts a search or hash without its leading ? or #", () => {
    assert.deepEqual(readUrlParams(declared, { search: "email=x", hash: "first_name=y" }), { email: "x", first_name: "y" });
  });

  it("merges both places; the query string wins when a name is in both", () => {
    assert.deepEqual(readUrlParams(declared, { search: "?utm_source=a", hash: "#utm_source=b&email=c" }), {
      utm_source: "a",
      email: "c",
    });
  });

  it("keeps only the declared names (exact spelling) and ignores the rest", () => {
    assert.deepEqual(readUrlParams(declared, { search: "?utm_medium=x&EMAIL=y&fbclid=z&email=ok" }), { email: "ok" });
    assert.deepEqual(readUrlParams([], { search: "?email=ok" }), {});
  });

  it("cuts values to 500 characters and drops empty ones", () => {
    const long = "x".repeat(PARAM_MAX_LENGTH + 40);
    const params = readUrlParams(declared, { search: `?email=${long}&utm_source=` });
    assert.equal(params.email.length, PARAM_MAX_LENGTH);
    assert.equal("utm_source" in params, false);
  });

  it("counts characters, not UTF-16 halves, when cutting", () => {
    const params = readUrlParams(declared, { search: `?email=${encodeURIComponent("😀".repeat(PARAM_MAX_LENGTH + 5))}` });
    assert.equal(Array.from(params.email).length, PARAM_MAX_LENGTH);
  });

  it("keeps values as plain text (no HTML interpretation, no decoding beyond the URL)", () => {
    const params = readUrlParams(declared, { search: "?first_name=%3Cb%3EAnn%3C%2Fb%3E" });
    assert.equal(params.first_name, "<b>Ann</b>");
  });

  it("survives malformed escapes and an empty location", () => {
    assert.equal(typeof readUrlParams(declared, { search: "?email=%E0%A4%A" }).email, "string");
    assert.deepEqual(readUrlParams(declared, {}), {});
    assert.deepEqual(readUrlParams(declared, { search: "", hash: "" }), {});
  });
});
