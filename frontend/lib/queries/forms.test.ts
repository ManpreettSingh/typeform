import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { QueryClient } from "@tanstack/react-query";
import type { Form, FormListItem } from "@/lib/types";
import { formKeys, patchLists, storeForm } from "./forms";

const theme = { question: "#000", answer: "#000", button: "#000", background: "#fff", font: "Inter" } as FormListItem["theme"];

const item = (id: number, title: string, workspace_id = 1): FormListItem => ({
  id,
  slug: `s${id}`,
  workspace_id,
  title,
  status: "draft",
  response_count: 0,
  response_total: 0,
  question_count: 0,
  created_at: "2026-10-09T00:00:00Z",
  updated_at: "2026-10-09T00:00:00Z",
  published_at: null,
  theme,
});

const form = (id: number, title: string, workspace_id = 1) =>
  ({ ...item(id, title, workspace_id), description: null, questions: [], endings: [] }) as unknown as Form;

// The dashboard reads the list of its workspace (key ["forms", "list", 1]); mutations used to write ["forms", "list",
// undefined] only, so renames, deletes, duplicates and publishes showed up only after a refetch.
function client() {
  const qc = new QueryClient();
  qc.setQueryData(formKeys.list(1), [item(1, "One"), item(2, "Two")]);
  qc.setQueryData(formKeys.list(2), [item(3, "Three", 2)]);
  return qc;
}

describe("form list cache", () => {
  it("storeForm updates the form in the workspace list the dashboard shows", () => {
    const qc = client();
    storeForm(qc, form(1, "Renamed"));
    assert.deepEqual(qc.getQueryData<FormListItem[]>(formKeys.list(1))!.map((f) => f.title), ["Renamed", "Two"]);
  });

  it("storeForm adds a new form only to its own workspace's list", () => {
    const qc = client();
    storeForm(qc, form(9, "Copy of One", 1));
    assert.deepEqual(qc.getQueryData<FormListItem[]>(formKeys.list(1))!.map((f) => f.id), [9, 1, 2]);
    assert.deepEqual(qc.getQueryData<FormListItem[]>(formKeys.list(2))!.map((f) => f.id), [3]);
  });

  it("patchLists edits every cached list and can roll back", async () => {
    const qc = client();
    const rollback = await patchLists(qc, (list) => list.filter((f) => f.id !== 2));
    assert.deepEqual(qc.getQueryData<FormListItem[]>(formKeys.list(1))!.map((f) => f.id), [1]);
    rollback();
    assert.deepEqual(qc.getQueryData<FormListItem[]>(formKeys.list(1))!.map((f) => f.id), [1, 2]);
  });
});
