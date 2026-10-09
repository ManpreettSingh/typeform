import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { options, question } from "./__fixtures__/questions";
import { isEmptyAnswer, toSubmission, validateAnswer } from "./validation";

const choices = options("A", "B", "C");

describe("isEmptyAnswer", () => {
  it("treats blank text, empty lists and missing values as empty", () => {
    assert.equal(isEmptyAnswer(undefined), true);
    assert.equal(isEmptyAnswer("   "), true);
    assert.equal(isEmptyAnswer([]), true);
    assert.equal(isEmptyAnswer(0), false);
    assert.equal(isEmptyAnswer(false), false);
  });
});

describe("validateAnswer", () => {
  it("asks for required answers and lets optional ones stay empty", () => {
    assert.equal(validateAnswer(question("short_text", {}, { required: true }), ""), "Please fill this in");
    assert.equal(validateAnswer(question("short_text"), ""), null);
  });

  it("limits text length", () => {
    const q = question("short_text", { max_length: 5 });
    assert.equal(validateAnswer(q, "12345"), null);
    assert.equal(validateAnswer(q, "123456"), "Please keep it under 5 characters");
  });

  it("checks emails", () => {
    const q = question("email");
    assert.equal(validateAnswer(q, "nope"), "Hmm… that email doesn't look right");
    assert.equal(validateAnswer(q, "a@b.co"), null);
  });

  it("checks numbers against min and max", () => {
    const q = question("number", { min: 1, max: 10 });
    assert.equal(validateAnswer(q, "abc"), "Please enter a number");
    assert.equal(validateAnswer(q, 0), "Please enter a number of 1 or more");
    assert.equal(validateAnswer(q, 11), "Please enter a number of 10 or less");
    assert.equal(validateAnswer(q, 5), null);
    assert.equal(validateAnswer(q, "7"), null);
  });

  it("checks ratings", () => {
    const q = question("rating", { max: 5, shape: "star" });
    assert.equal(validateAnswer(q, 0), "Please choose a rating");
    assert.equal(validateAnswer(q, 2.5), "Please choose a rating");
    assert.equal(validateAnswer(q, 3), null);
  });

  it("checks yes/no", () => {
    const q = question("yes_no");
    assert.equal(validateAnswer(q, "yes"), "Please choose Yes or No");
    assert.equal(validateAnswer(q, true), null);
    assert.equal(validateAnswer(q, false), null);
  });

  it("checks single and multiple choice", () => {
    const single = question("multiple_choice", { options: choices, allow_multiple: false, allow_other: false });
    assert.equal(validateAnswer(single, ["a", "b"]), "Please choose one option");
    assert.equal(validateAnswer(single, "zzz"), "Please choose from the options");
    assert.equal(validateAnswer(single, "a"), null);
    const multi = question("multiple_choice", { options: choices, allow_multiple: true, allow_other: false });
    assert.equal(validateAnswer(multi, ["a", "b"]), null);
    assert.equal(validateAnswer(multi, ["a", "zzz"]), "Please choose from the options");
  });

  it("checks dropdowns", () => {
    const q = question("dropdown", { options: choices });
    assert.equal(validateAnswer(q, "zzz"), "Please choose from the list");
    assert.equal(validateAnswer(q, "b"), null);
  });
});

describe("toSubmission", () => {
  it("trims text, sends numbers as numbers and drops empty answers", () => {
    const [name, age, note] = [question("short_text"), question("number"), question("long_text")];
    const body = toSubmission([name, age, note], { [name.id]: "  Ann  ", [age.id]: "7", [note.id]: "   " });
    assert.deepEqual(body, { answers: { [name.id]: "Ann", [age.id]: 7 } });
  });

  it("leaves out answers to questions the respondent's path skipped", () => {
    const first = question("yes_no");
    const skipped = question("short_text");
    const last = question("short_text");
    first.logic = { rules: [{ op: "is", value: true, to: last.id }] };
    const body = toSubmission([first, skipped, last], { [first.id]: true, [skipped.id]: "hidden", [last.id]: "kept" });
    assert.deepEqual(body, { answers: { [first.id]: true, [last.id]: "kept" } });
  });
});

describe("website and phone number", () => {
  // Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
  const WEB = "Hmm… that web address doesn’t look right. Check for any typos or errors.";
  const PHONE = "Hmm... that phone number doesn't look right";

  it("accepts bare domains and http(s) addresses", () => {
    const q = question("website");
    for (const ok of ["example.com", "https://example.com/path?x=1#frag", "http://sub.example.co.uk"]) {
      assert.equal(validateAnswer(q, ok), null, ok);
    }
  });

  it("rejects other schemes and text that is not an address", () => {
    const q = question("website");
    for (const bad of ["javascript:alert(1)", "ftp://example.com", "hello", "exa mple.com", "http://localhost", "example.", "https://"]) {
      assert.equal(validateAnswer(q, bad), WEB, bad);
    }
  });

  it("reads phone numbers in the question's default country", () => {
    assert.equal(validateAnswer(question("phone_number", { default_country: "US" }), "(201) 555-0123"), null);
    assert.equal(validateAnswer(question("phone_number", { default_country: "GB" }), "020 7946 0958"), null);
    assert.equal(validateAnswer(question("phone_number", { default_country: "IN" }), "+44 20 7946 0958"), null);
  });

  it("rejects short or nonsense phone numbers", () => {
    const q = question("phone_number", { default_country: "US" });
    for (const bad of ["123", "abc", "(201) 555-01"]) assert.equal(validateAnswer(q, bad), PHONE, bad);
  });

  it("sends phone numbers in E.164 and websites trimmed", () => {
    const phone = question("phone_number", { default_country: "US" });
    const site = question("website");
    const body = toSubmission([phone, site], { [phone.id]: "(201) 555-0123", [site.id]: " example.com " });
    assert.deepEqual(body, { answers: { [phone.id]: "+12015550123", [site.id]: "example.com" } });
  });
});

describe("legal and checkbox", () => {
  // Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
  const AGREE = "Please agree to the terms & conditions";
  const SELECT = "Oops! Please make a selection";

  it("lets an optional legal question be accepted, declined or left alone", () => {
    const q = question("legal");
    assert.equal(validateAnswer(q, true), null);
    assert.equal(validateAnswer(q, false), null);
    assert.equal(validateAnswer(q, undefined), null);
  });

  it("makes a required legal question insist on agreement", () => {
    const q = question("legal", {}, { required: true });
    assert.equal(validateAnswer(q, false), AGREE);
    assert.equal(validateAnswer(q, undefined), AGREE);
    assert.equal(validateAnswer(q, true), null);
  });

  it("makes a required checkbox insist on a tick", () => {
    const q = question("checkbox", { label: "I agree" }, { required: true });
    assert.equal(validateAnswer(q, undefined), SELECT);
    assert.equal(validateAnswer(q, false), SELECT);
    assert.equal(validateAnswer(q, true), null);
    assert.equal(validateAnswer(question("checkbox", { label: "" }), undefined), null);
  });

  it("only takes true or false", () => {
    for (const type of ["legal", "checkbox"] as const) {
      assert.notEqual(validateAnswer(question(type, {}), "yes" as never), null, type);
      assert.notEqual(validateAnswer(question(type, {}), 1 as never), null, type);
    }
  });

  it("keeps a declined answer in the submission", () => {
    const legal = question("legal");
    assert.deepEqual(toSubmission([legal], { [legal.id]: false }), { answers: { [legal.id]: false } });
  });
});

describe("opinion scale and NPS", () => {
  const labels = { left: "", center: "", right: "" };

  it("follows the opinion scale's start and steps", () => {
    const fromOne = question("opinion_scale", { steps: 10, start_at_one: true, labels });
    assert.equal(validateAnswer(fromOne, 1), null);
    assert.equal(validateAnswer(fromOne, 10), null);
    assert.equal(validateAnswer(fromOne, 0), "Please choose a rating");
    assert.equal(validateAnswer(fromOne, 11), "Please choose a rating");
    const fromZero = question("opinion_scale", { steps: 11, start_at_one: false, labels });
    assert.equal(validateAnswer(fromZero, 0), null);
    assert.equal(validateAnswer(fromZero, 10), null);
    assert.equal(validateAnswer(fromZero, 11), "Please choose a rating");
    assert.equal(validateAnswer(fromZero, 4.5), "Please choose a rating");
  });

  it("takes whole numbers from 0 to 10 for NPS", () => {
    const q = question("nps", { labels });
    for (const ok of [0, 6, 7, 10]) assert.equal(validateAnswer(q, ok), null, String(ok));
    for (const bad of [11, -1, 5.5]) assert.equal(validateAnswer(q, bad), "Please choose a rating", String(bad));
  });

  it("still asks for a required answer", () => {
    assert.equal(validateAnswer(question("nps", { labels }, { required: true }), undefined), "Please fill this in");
    assert.equal(validateAnswer(question("nps", { labels }, { required: true }), 0), null);
  });
});

describe("date", () => {
  // Typeform's default texts (docs/design/typeform-free-features-audit.md, section 4).
  const INVALID = "That date doesn't look valid—it's incomplete or doesn't exist";
  const REVERSED = "That date isn't valid. Check the month and day aren't reversed.";
  const props = { format: "MMDDYYYY", separator: "/" };

  it("accepts real dates, including a leap day", () => {
    const q = question("date", props);
    for (const ok of ["2028-02-29", "2026-1-5", "2026-12-31"]) assert.equal(validateAnswer(q, ok), null, ok);
  });

  it("rejects dates that don't exist and incomplete input", () => {
    const q = question("date", props);
    for (const bad of ["2026-02-30", "2027-02-29", "0000-01-01", "2026-", "2026-05-", "20-5-7", "abc"]) {
      assert.equal(validateAnswer(q, bad), INVALID, bad);
    }
  });

  it("notices a day and month typed the other way round", () => {
    const q = question("date", props);
    assert.equal(validateAnswer(q, "2026-13-01"), REVERSED);
    assert.equal(validateAnswer(q, "2026-13-13"), INVALID);
  });

  it("enforces the start and end dates with Typeform's wording, in the question's own format", () => {
    const after = question("date", { ...props, start_date: "2026-01-15" });
    assert.equal(validateAnswer(after, "2026-01-14"), "Choose a date on or after 01/15/2026.");
    assert.equal(validateAnswer(after, "2026-01-15"), null);
    const before = question("date", { ...props, end_date: "2026-12-31" });
    assert.equal(validateAnswer(before, "2027-01-01"), "Choose a date on or before 12/31/2026.");
    const both = question("date", { ...props, start_date: "2026-01-15", end_date: "2026-12-31" });
    assert.equal(validateAnswer(both, "2025-12-31"), "Choose a date between 01/15/2026 and 12/31/2026.");
    const iso = question("date", { format: "YYYYMMDD", separator: "-", start_date: "2026-01-15" });
    assert.equal(validateAnswer(iso, "2026-01-14"), "Choose a date on or after 2026-01-15.");
  });
});
