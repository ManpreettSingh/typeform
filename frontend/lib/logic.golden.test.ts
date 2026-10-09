// Runs the shared golden cases (backend/tests/fixtures/logic_cases.json) against the client resolver.
// The Python resolver runs the same file (backend/tests/test_logic_golden.py): either one failing a case fails CI.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { resolve, type ResolveForm } from "./logic";
import type { Answers, EndingRef, VariableValues } from "./types";

type GoldenCase = {
  name: string;
  form: ResolveForm;
  answers: Answers;
  params: Record<string, string>;
  expected: { path: number[]; variables: VariableValues; ending: EndingRef };
};

const here = dirname(fileURLToPath(import.meta.url));
const file = join(here, "..", "..", "backend", "tests", "fixtures", "logic_cases.json");
const { cases } = JSON.parse(readFileSync(file, "utf8")) as { cases: GoldenCase[] };

describe("logic resolver: golden cases shared with the server", () => {
  it("loads the fixture", () => {
    assert.ok(cases.length >= 40, `expected the lead's 45 cases, found ${cases.length}`);
  });

  for (const c of cases) {
    it(c.name, () => {
      const result = resolve(c.form, c.answers, c.params);
      assert.deepEqual(result.path, c.expected.path, "path");
      assert.deepEqual(result.variables, c.expected.variables, "variables");
      assert.deepEqual(result.ending, c.expected.ending, "ending");
    });
  }
});
