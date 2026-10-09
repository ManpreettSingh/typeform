"use client";

import { useId } from "react";
import { Input, Select } from "@/components/ui";
import type { DateFormat, DateProperties, DateSeparator, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { SwitchRow } from "../panel/PanelCard";

const FORMATS: { value: DateFormat; label: string }[] = [
  { value: "MMDDYYYY", label: "MMDDYYYY" },
  { value: "DDMMYYYY", label: "DDMMYYYY" },
  { value: "YYYYMMDD", label: "YYYYMMDD" },
];
const SEPARATORS: { value: DateSeparator; label: string }[] = [
  { value: "/", label: "/" },
  { value: "-", label: "-" },
  { value: ".", label: "." },
];

const today = () => new Date().toISOString().slice(0, 10);

/** Date format, separator and the optional earliest / latest date, in the order of Typeform's panel. */
export function DateSettings({ question }: { question: QuestionOf<"date"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  const formatId = useId();
  const separatorId = useId();

  const save = (next: DateProperties) => updateQuestion(question.id, { properties: next }, 0);
  const without = (key: "start_date" | "end_date") =>
    save(Object.fromEntries(Object.entries(props).filter(([name]) => name !== key)) as DateProperties);

  return (
    <>
      <div className="flex flex-col gap-1.5 py-2">
        <span className="text-sm text-text-muted">Date format</span>
        <div className="flex gap-2">
          <div className="min-w-0 flex-1">
            <Select<DateFormat>
              id={formatId}
              aria-label="Date format"
              options={FORMATS}
              value={props.format}
              onChange={(format) => save({ ...props, format })}
            />
          </div>
          <div className="w-16">
            <Select<DateSeparator>
              id={separatorId}
              aria-label="Separator"
              options={SEPARATORS}
              value={props.separator}
              onChange={(separator) => save({ ...props, separator })}
            />
          </div>
        </div>
      </div>

      <SwitchRow
        label="Start date"
        checked={props.start_date !== undefined}
        onChange={(on) =>
          on
            ? save({ ...props, start_date: props.end_date && today() > props.end_date ? props.end_date : today() })
            : without("start_date")
        }
      >
        <Input
          aria-label="Start date"
          type="date"
          max={props.end_date}
          value={props.start_date ?? ""}
          onChange={(e) => e.target.value && save({ ...props, start_date: e.target.value })}
        />
      </SwitchRow>

      <SwitchRow
        label="End date"
        checked={props.end_date !== undefined}
        onChange={(on) =>
          on
            ? save({ ...props, end_date: props.start_date && today() < props.start_date ? props.start_date : today() })
            : without("end_date")
        }
      >
        <Input
          aria-label="End date"
          type="date"
          min={props.start_date}
          value={props.end_date ?? ""}
          onChange={(e) => e.target.value && save({ ...props, end_date: e.target.value })}
        />
      </SwitchRow>
    </>
  );
}
