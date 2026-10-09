"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";
import { Button, Modal, Select } from "@/components/ui";
import { ApiError, getErrorMessage } from "@/lib/api";
import { IMPORT_PROPERTIES, buildImportRows, guessMapping, parseCsv, type ImportProperty } from "@/lib/contacts";
import { pluralize } from "@/lib/format";
import { useImportContacts, type ImportResult } from "@/lib/queries/contacts";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;
const PREVIEW_ROWS = 3;

type Parsed = { fileName: string; table: string[][]; mapping: ImportProperty[] };

/** "Add with import": choose a CSV, match its columns to contact properties, import. */
export function ImportContactsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  // Everything inside resets when the dialog is closed and opened again.
  return open ? <Importer onClose={onClose} /> : null;
}

function Importer({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const importContacts = useImportContacts();
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) return setError("That file is too big. The limit is 5MB.");
    const table = parseCsv(await file.text());
    if (table.length < 2) return setError("We couldn't find any contacts in that file. It needs a header row and at least one contact.");
    if (table.length - 1 > MAX_ROWS) return setError(`That file has more than ${MAX_ROWS.toLocaleString("en")} contacts. Split it and import it in parts.`);
    setParsed({ fileName: file.name, table, mapping: guessMapping(table[0]) });
  }

  const mapped = new Set(parsed?.mapping);
  const identifiable = mapped.has("email") || mapped.has("name") || mapped.has("first_name") || mapped.has("last_name");

  async function submit() {
    if (!parsed) return;
    setError(null);
    try {
      setResult(await importContacts.mutateAsync(buildImportRows(parsed.table, parsed.mapping)));
    } catch (e) {
      setError(e instanceof ApiError ? getErrorMessage(e) : "The import didn't go through. Please try again.");
    }
  }

  const input = (
    <input ref={inputRef} type="file" accept=".csv,text/csv" className="sr-only" tabIndex={-1} aria-label="Choose a CSV file" onChange={(e) => {
      void choose(e.target.files?.[0]);
      e.target.value = "";
    }} />
  );

  if (result) {
    return (
      <Modal open onClose={onClose} title="Import finished" footer={<Button onClick={onClose}>Done</Button>}>
        <p className="text-sm text-text">
          {pluralize(result.created, "contact")} added, {pluralize(result.updated, "contact")} updated
          {result.errors.length > 0 && `, ${pluralize(result.errors.length, "row")} skipped`}.
        </p>
        {result.errors.length > 0 && (
          <ul className="mt-3 max-h-48 overflow-y-auto rounded-input bg-bg-subtle p-3 text-sm text-text-muted">
            {result.errors.slice(0, 50).map((e) => (
              <li key={e.row}>
                Row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Import contacts from a CSV file"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={importContacts.isPending}>
            Cancel
          </Button>
          {parsed && (
            <Button onClick={() => void submit()} loading={importContacts.isPending} disabled={!identifiable}>
              Import {pluralize(parsed.table.length - 1, "contact")}
            </Button>
          )}
        </>
      }
    >
      {!parsed ? (
        <div className="flex flex-col items-center gap-3 rounded-card border-2 border-dashed border-border-strong px-6 py-12 text-center">
          <FileUp className="size-8 text-text-muted" aria-hidden />
          <p className="text-sm text-text">Choose a CSV file with one contact per row and a header row.</p>
          <Button variant="secondary" onClick={() => inputRef.current?.click()}>
            Choose file
          </Button>
          {input}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-muted">
            <span className="font-medium text-text">{parsed.fileName}</span>: match each column to a contact property. Contacts are matched by email, so
            importing someone who already exists updates them.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-text-muted">
                <tr>
                  <th className="py-2 pr-4 font-medium">Column in your file</th>
                  <th className="py-2 pr-4 font-medium">Example</th>
                  <th className="w-56 py-2 font-medium">Contact property</th>
                </tr>
              </thead>
              <tbody>
                {parsed.table[0].map((header, column) => (
                  <tr key={column} className="border-t border-border">
                    <td className="py-2 pr-4 font-medium text-text">{header || `Column ${column + 1}`}</td>
                    <td className="max-w-56 truncate py-2 pr-4 text-text-muted">
                      {parsed.table
                        .slice(1, 1 + PREVIEW_ROWS)
                        .map((row) => row[column])
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="py-2">
                      <Select<string>
                        aria-label={`Property for ${header || `column ${column + 1}`}`}
                        options={IMPORT_PROPERTIES}
                        value={parsed.mapping[column]}
                        onChange={(value) =>
                          setParsed({ ...parsed, mapping: parsed.mapping.map((m, i) => (i === column ? (value as ImportProperty) : m)) })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!identifiable && <p className="text-sm text-danger">Match at least an email or a name column to import.</p>}
          <button type="button" onClick={() => setParsed(null)} className="self-start text-sm font-medium text-accent hover:underline">
            Choose a different file
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
    </Modal>
  );
}
