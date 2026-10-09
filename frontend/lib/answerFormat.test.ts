import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatAnswer, formatNumber } from "./answerFormat";
import { options, question } from "./__fixtures__/questions";

describe("formatAnswer", () => {
  it("shows yes/no, ratings and numbers readably", () => {
    assert.equal(formatAnswer(question("yes_no"), true), "Yes");
    assert.equal(formatAnswer(question("yes_no"), false), "No");
    assert.equal(formatAnswer(question("rating", { max: 5, shape: "star" }), 4), "4/5");
    assert.equal(formatAnswer(question("number"), 1234.5), "1,234.5");
    assert.equal(formatAnswer(question("number"), "oops"), "oops");
  });

  it("joins choice labels and marks removed or untitled choices", () => {
    const props = { options: [...options("A"), { id: "b", label: "" }], allow_multiple: true, allow_other: false };
    const q = question("multiple_choice", props);
    assert.equal(formatAnswer(q, ["a", "b"]), "A, (untitled choice)");
    assert.equal(formatAnswer(q, ["a", "gone"]), "A, (removed choice)");
    assert.equal(formatAnswer(question("dropdown", { options: options("X") }), "a"), "X");
  });

  it("passes text through and treats a missing answer as empty", () => {
    assert.equal(formatAnswer(question("short_text"), "hello"), "hello");
    assert.equal(formatAnswer(question("short_text"), undefined), "");
  });

  it("formats plain numbers with grouping", () => {
    assert.equal(formatNumber(1000), "1,000");
    assert.equal(formatNumber(0.126), "0.13");
  });
});

describe("formatAnswer for website and phone number", () => {
  it("shows phone numbers in international format and leaves unreadable ones as stored", () => {
    const q = question("phone_number", { default_country: "US" });
    assert.equal(formatAnswer(q, "+442079460958"), "+44 20 7946 0958");
    assert.equal(formatAnswer(q, "not a number"), "not a number");
  });

  it("shows websites as typed", () => {
    assert.equal(formatAnswer(question("website"), "example.com"), "example.com");
  });
});

describe("formatAnswer for consent and scales", () => {
  it("shows legal and checkbox answers in words", () => {
    assert.equal(formatAnswer(question("legal"), true), "Accepted");
    assert.equal(formatAnswer(question("legal"), false), "Declined");
    assert.equal(formatAnswer(question("checkbox", { label: "" }), true), "Checked");
    assert.equal(formatAnswer(question("checkbox", { label: "" }), false), "Unchecked");
  });

  it("shows opinion scale and NPS answers as the number picked", () => {
    assert.equal(formatAnswer(question("opinion_scale", { steps: 10, start_at_one: true }), 7), "7");
    assert.equal(formatAnswer(question("nps"), 0), "0");
  });
});

describe("formatAnswer for dates", () => {
  it("shows the date in the question's own format and leaves unreadable values as stored", () => {
    assert.equal(formatAnswer(question("date", { format: "DDMMYYYY", separator: "." }), "2026-03-07"), "07.03.2026");
    assert.equal(formatAnswer(question("date", { format: "MMDDYYYY", separator: "/" }), "2026-03-07"), "03/07/2026");
    assert.equal(formatAnswer(question("date", { format: "YYYYMMDD", separator: "-" }), "2026-03-07"), "2026-03-07");
    assert.equal(formatAnswer(question("date", { format: "MMDDYYYY", separator: "/" }), "garbled"), "garbled");
  });
});
