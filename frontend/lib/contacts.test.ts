import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FILTER_PROPERTIES,
  buildImportRows,
  conditionIsComplete,
  contactLabel,
  defaultCondition,
  guessMapping,
  opsFor,
  parseCsv,
  sourceLabel,
  toApiFilters,
} from "./contacts";

describe("parseCsv", () => {
  it("reads plain rows", () => {
    assert.deepEqual(parseCsv("a,b\n1,2\n3,4"), [
      ["a", "b"],
      ["1", "2"],
      ["3", "4"],
    ]);
  });

  it("handles quotes, commas and line breaks inside quotes, and doubled quotes", () => {
    const csv = 'name,note\r\n"Smith, Jo","said ""hi""\nthen left"\r\nAna,ok\r\n';
    assert.deepEqual(parseCsv(csv), [
      ["name", "note"],
      ["Smith, Jo", 'said "hi"\nthen left'],
      ["Ana", "ok"],
    ]);
  });

  it("drops a BOM, blank lines and trailing blank cells' rows", () => {
    assert.deepEqual(parseCsv("﻿email,name\n\na@x.io,A\n,\n"), [
      ["email", "name"],
      ["a@x.io", "A"],
    ]);
  });

  it("detects semicolons and tabs, as Excel writes them in many countries", () => {
    assert.deepEqual(parseCsv("email;name\na@x.io;Ana"), [
      ["email", "name"],
      ["a@x.io", "Ana"],
    ]);
    assert.deepEqual(parseCsv("email\tname\na@x.io\tAna"), [
      ["email", "name"],
      ["a@x.io", "Ana"],
    ]);
  });

  it("keeps a comma inside quotes from being taken as the delimiter", () => {
    assert.deepEqual(parseCsv('"a;b,c",d\n1,2'), [
      ["a;b,c", "d"],
      ["1", "2"],
    ]);
  });

  it("returns nothing for an empty file", () => {
    assert.deepEqual(parseCsv(""), []);
    assert.deepEqual(parseCsv("\n\n"), []);
  });
});

describe("guessMapping: which property each column most likely is", () => {
  it("recognises common headers, however they are capitalised or punctuated", () => {
    assert.deepEqual(guessMapping(["E-mail Address", "Full Name", "Mobile", "Organization", "Comments", "Subscription status", "Favourite colour"]), [
      "email",
      "name",
      "phone",
      "company",
      "notes",
      "subscription_status",
      "ignore",
    ]);
  });

  it("maps first and last name columns separately", () => {
    assert.deepEqual(guessMapping(["First name", "Last name", "Email"]), ["first_name", "last_name", "email"]);
  });

  it("uses each property for one column only", () => {
    assert.deepEqual(guessMapping(["Email", "Email 2", "Name"]), ["email", "ignore", "name"]);
  });
});

describe("buildImportRows", () => {
  const table = [
    ["Mail", "First", "Last", "Tel", "Extra"],
    ["a@x.io", "Ana", "Silva", "+1 201 555 0123", "skip me"],
    ["b@x.io", "", "", "", ""],
  ];
  const mapping = ["email", "first_name", "last_name", "phone", "ignore"] as const;

  it("turns rows into contacts, joining first and last name and leaving ignored columns out", () => {
    assert.deepEqual(buildImportRows(table, [...mapping]), [
      { email: "a@x.io", name: "Ana Silva", phone: "+1 201 555 0123" },
      { email: "b@x.io" },
    ]);
  });

  it("prefers a full-name column over first and last", () => {
    const rows = buildImportRows(
      [
        ["Email", "Name", "First"],
        ["a@x.io", "Ana Silva", "Anna"],
      ],
      ["email", "name", "first_name"],
    );
    assert.deepEqual(rows, [{ email: "a@x.io", name: "Ana Silva" }]);
  });

  it("copes with short rows", () => {
    assert.deepEqual(buildImportRows([["Email", "Name"], ["a@x.io"]], ["email", "name"]), [{ email: "a@x.io" }]);
  });
});

describe("filters", () => {
  it("offers Typeform's conditions for each kind of property", () => {
    assert.deepEqual(
      opsFor("company").map((o) => o.label),
      ["Contains", "Does not contain", "Is empty", "Is not empty"],
    );
    assert.deepEqual(
      opsFor("subscription_status").map((o) => o.label),
      ["Is", "Is not"],
    );
    assert.deepEqual(
      opsFor("last_change").map((o) => o.label),
      ["Is before", "Is after"],
    );
    assert.equal(FILTER_PROPERTIES.length, 7);
  });

  it("a condition is complete when it has the value its operator needs", () => {
    assert.equal(conditionIsComplete({ property: "name", op: "contains", value: "" }), false);
    assert.equal(conditionIsComplete({ property: "name", op: "contains", value: "ana" }), true);
    assert.equal(conditionIsComplete({ property: "name", op: "is_empty", value: "" }), true);
    assert.equal(conditionIsComplete({ property: "last_change", op: "before", value: "" }), false);
  });

  it("sends only complete conditions, and nothing at all when there are none", () => {
    assert.equal(toApiFilters("and", [defaultCondition()]), null);
    assert.deepEqual(
      toApiFilters("or", [
        { property: "name", op: "contains", value: "ana" },
        { property: "email", op: "contains", value: "" },
        { property: "phone", op: "is_empty", value: "" },
      ]),
      {
        operator: "or",
        conditions: [
          { property: "name", op: "contains", value: "ana" },
          { property: "phone", op: "is_empty", value: null },
        ],
      },
    );
  });
});

describe("labels", () => {
  it("shows the name, or the email when there is none, or a placeholder", () => {
    assert.equal(contactLabel({ name: "Ana", email: "a@x.io" }), "Ana");
    assert.equal(contactLabel({ name: null, email: "a@x.io" }), "a@x.io");
    assert.equal(contactLabel({ name: null, email: null }), "Unnamed contact");
  });

  it("names where a contact came from", () => {
    assert.equal(sourceLabel({ type: "form", form_id: 1, form_title: "Survey" }), "Survey");
    assert.equal(sourceLabel({ type: "form", form_id: 1, form_title: null }), "A deleted form");
    assert.equal(sourceLabel({ type: "manual" }), "Manual edit");
    assert.equal(sourceLabel({ type: "csv_import" }), "CSV import");
  });
});
