"use client";

import { useRef, useEffect, KeyboardEvent } from "react";
import type { AnswerProps } from "../types";
import type { ContactInfoProperties, AddressProperties, CompositeField } from "@/lib/types";

type CompositeType = "contact_info" | "address";

export function CompositeAnswer<T extends CompositeType>({ question, value, onChange, onSubmit, live }: AnswerProps<T>) {
  const props = (question as unknown as { properties: ContactInfoProperties | AddressProperties }).properties;
  const fields = props.fields.filter((f: CompositeField) => f.enabled);
  const v = (value as Record<string, string>) || {};

  const refs = useRef<(HTMLInputElement | null)[]>([]);
  
  useEffect(() => {
    if (live && refs.current[0]) {
      refs.current[0].focus();
    }
  }, [live]);

  const handleChange = (key: string, val: string) => {
    onChange({ ...v, [key]: val } as AnswerProps<T>["value"]);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>, index: number) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (index === fields.length - 1) {
        onSubmit();
      } else {
        refs.current[index + 1]?.focus();
      }
    }
  };

  return (
    <div className="flex flex-col gap-4 w-full max-w-lg">
      {fields.map((f: CompositeField, i: number) => (
        <div key={f.key} className="flex flex-col gap-1">
          <label htmlFor={`composite-${f.key}`} className="text-sm font-semibold text-gray-700">
            {f.label}{f.required ? " *" : ""}
          </label>
          <input
            ref={(el) => { refs.current[i] = el; }}
            id={`composite-${f.key}`}
            type={f.key === "email" ? "email" : f.key === "phone_number" ? "tel" : "text"}
            className="w-full bg-transparent border-b border-gray-300 py-2 outline-none focus:border-qt-text text-xl transition-colors"
            value={v[f.key] ?? ""}
            onChange={(e) => handleChange(f.key, e.target.value)}
            onKeyDown={(e) => handleKeyDown(e, i)}
          />
        </div>
      ))}
    </div>
  );
}
