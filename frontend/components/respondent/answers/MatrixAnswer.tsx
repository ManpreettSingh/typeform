"use client";

import type { AnswerProps } from "../types";
import { Button } from "@/components/ui";
import { Check } from "lucide-react";

export function MatrixAnswer({ question, value, onChange, onSubmit }: AnswerProps<"matrix">) {
  const props = question.properties;
  const { rows, columns, multiple_selection } = props;
  
  const v = (value as Record<string, string | string[]>) || {};

  const toggle = (rowId: string, colId: string) => {
    if (multiple_selection) {
      const current = Array.isArray(v[rowId]) ? (v[rowId] as string[]) : (v[rowId] ? [v[rowId] as string] : []);
      if (current.includes(colId)) {
        onChange({ ...v, [rowId]: current.filter(c => c !== colId) });
      } else {
        onChange({ ...v, [rowId]: [...current, colId] });
      }
    } else {
      onChange({ ...v, [rowId]: colId });
    }
  };

  const isSelected = (rowId: string, colId: string) => {
    if (multiple_selection) {
      const current = Array.isArray(v[rowId]) ? (v[rowId] as string[]) : (v[rowId] ? [v[rowId] as string] : []);
      return current.includes(colId);
    }
    return v[rowId] === colId;
  };

  return (
    <div className="flex flex-col gap-6 max-w-4xl w-full overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-max">
        <thead>
          <tr>
            <th className="p-3 border-b border-border text-sm font-medium text-text-muted"></th>
            {columns.map(c => (
              <th key={c.id} className="p-3 border-b border-border text-sm font-medium text-text-muted text-center whitespace-nowrap">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-bg-subtle transition-colors">
              <td className="p-3 border-b border-border text-sm font-medium text-text">{r.label}</td>
              {columns.map(c => {
                const selected = isSelected(r.id, c.id);
                return (
                  <td key={c.id} className="p-3 border-b border-border text-center">
                    <button
                      type="button"
                      onClick={() => toggle(r.id, c.id)}
                      className="inline-flex items-center justify-center size-6 rounded focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
                      aria-label={`Select ${c.label} for ${r.label}`}
                    >
                      {multiple_selection ? (
                        <div className={`size-5 flex items-center justify-center border rounded transition-colors ${selected ? "bg-accent border-accent text-white" : "border-border-strong bg-field"}`}>
                          {selected && <Check className="size-3.5" />}
                        </div>
                      ) : (
                        <div className={`size-5 flex items-center justify-center border rounded-full transition-colors ${selected ? "border-accent border-4 bg-field" : "border-border-strong bg-field"}`} />
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="pt-2">
        <Button onClick={() => onSubmit()}>Submit</Button>
      </div>
    </div>
  );
}
