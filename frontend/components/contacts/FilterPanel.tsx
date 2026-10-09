"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Input, Select } from "@/components/ui";
import {
  FILTER_PROPERTIES,
  SELECTABLE_STATUSES,
  SUBSCRIPTION_LABELS,
  defaultCondition,
  opsFor,
  toApiFilters,
  type ApiFilters,
  type FilterCondition,
  type FilterOperator,
  type FilterProperty,
} from "@/lib/contacts";

type Props = {
  /** The filters in force now; the panel starts from them. */
  applied: ApiFilters | null;
  onApply: (filters: ApiFilters | null) => void;
  onSaveAsList: (filters: ApiFilters) => void;
  onClose: () => void;
};

const STATUS_OPTIONS = [...SELECTABLE_STATUSES, "suppressed" as const].map((s) => ({ value: s as string, label: SUBSCRIPTION_LABELS[s] }));
const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: "and", label: "all" },
  { value: "or", label: "any" },
];

function fromApplied(applied: ApiFilters | null): FilterCondition[] {
  if (!applied) return [defaultCondition()];
  return applied.conditions.map((c) => ({ property: c.property, op: c.op, value: c.value ?? "" }));
}

/** Typeform's Filter: conditions on properties, combined with AND / OR, applied to the table or saved as a list. */
export function FilterPanel({ applied, onApply, onSaveAsList, onClose }: Props) {
  const [operator, setOperator] = useState<FilterOperator>(applied?.operator ?? "and");
  const [conditions, setConditions] = useState<FilterCondition[]>(() => fromApplied(applied));

  const filters = toApiFilters(operator, conditions);
  const change = (index: number, patch: Partial<FilterCondition>) =>
    setConditions((all) => all.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  function changeProperty(index: number, property: FilterProperty) {
    // A new property has its own conditions and values, so start the row afresh.
    change(index, { property, op: opsFor(property)[0].value, value: property === "subscription_status" ? "subscribed" : "" });
  }

  return (
    <section
      aria-label="Filter contacts"
      className="absolute top-full left-0 z-30 mt-2 w-[min(40rem,calc(100vw-2rem))] rounded-card border border-border-strong bg-bg p-4 shadow-lg"
    >
      <div className="mb-3 flex items-center gap-2 text-sm text-text">
        Show contacts that match
        <div className="w-24">
          <Select<FilterOperator> aria-label="Match" options={OPERATORS} value={operator} onChange={setOperator} />
        </div>
        of these conditions
      </div>

      <ul className="flex flex-col gap-2">
        {conditions.map((condition, index) => {
          const op = opsFor(condition.property).find((o) => o.value === condition.op);
          return (
            <li key={index} className="flex flex-wrap items-center gap-2">
              <div className="w-40">
                <Select<FilterProperty>
                  aria-label="Property"
                  options={FILTER_PROPERTIES}
                  value={condition.property}
                  onChange={(property) => changeProperty(index, property)}
                />
              </div>
              <div className="w-44">
                <Select<string>
                  aria-label="Condition"
                  options={opsFor(condition.property).map((o) => ({ value: o.value, label: o.label }))}
                  value={condition.op}
                  onChange={(value) => change(index, { op: value })}
                />
              </div>
              <div className="min-w-0 flex-1">
                {op?.needsValue &&
                  (condition.property === "subscription_status" ? (
                    <Select<string> aria-label="Value" options={STATUS_OPTIONS} value={condition.value || "subscribed"} onChange={(value) => change(index, { value })} />
                  ) : (
                    <Input
                      aria-label="Value"
                      type={condition.property === "last_change" ? "date" : "text"}
                      placeholder="Value"
                      value={condition.value}
                      onChange={(e) => change(index, { value: e.target.value })}
                    />
                  ))}
              </div>
              <IconButton
                label="Remove filter"
                size="sm"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConditions((all) => (all.length === 1 ? [defaultCondition()] : all.filter((_, i) => i !== index)))}
              />
            </li>
          );
        })}
      </ul>

      <Button variant="ghost" size="sm" className="mt-2" leftIcon={<Plus className="size-4" />} onClick={() => setConditions((all) => [...all, defaultCondition()])}>
        Add filter
      </Button>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="secondary" size="sm" disabled={!filters} onClick={() => filters && onSaveAsList(filters)}>
          Save as new list
        </Button>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onApply(null);
              onClose();
            }}
          >
            Clear
          </Button>
          <Button
            size="sm"
            onClick={() => {
              onApply(filters);
              onClose();
            }}
          >
            Apply
          </Button>
        </div>
      </div>
    </section>
  );
}
