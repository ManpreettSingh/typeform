"use client";

import { clsx } from "clsx";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { AnswerProps } from "../types";

/** Typeform-style searchable dropdown: a combobox input that filters a listbox. */
export function DropdownAnswer({ question, value, onChange, onSubmit, live, labelledBy }: AnswerProps<"dropdown">) {
  const { options } = question.properties;
  const selected = options.find((o) => o.id === value);
  const [query, setQuery] = useState(selected?.label ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (live) inputRef.current?.focus({ preventScroll: true });
  }, [live]);

  // While the text still equals the chosen label, show every option; otherwise filter by it.
  const filtering = query.trim() !== "" && query !== selected?.label;
  const visible = filtering ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase())) : options;

  function choose(id: string) {
    const option = options.find((o) => o.id === id);
    onChange(id);
    setQuery(option?.label ?? "");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) => (visible.length ? (i + step + visible.length) % visible.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && visible[active]) choose(visible[active].id);
      else onSubmit();
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
    }
  }

  return (
    <div className="relative max-w-xl">
      <div className="flex items-center border-b border-resp-accent/30 focus-within:border-resp-accent focus-within:shadow-[0_1px_0_var(--resp-accent)]">
        <input
          ref={inputRef}
          role="combobox"
          aria-labelledby={labelledBy}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && visible[active] ? `${listId}-${visible[active].id}` : undefined}
          className="w-full bg-transparent pb-2 text-2xl font-light text-resp-accent placeholder:text-resp-accent/40 focus:outline-none sm:text-3xl"
          placeholder="Type or select an option"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery(selected?.label ?? "");
          }}
          onKeyDown={onKeyDown}
        />
        {selected ? (
          <button
            type="button"
            aria-label="Clear selection"
            className="p-1 text-resp-accent"
            onClick={() => {
              onChange(undefined);
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <X className="size-6" aria-hidden />
          </button>
        ) : (
          <ChevronDown className="size-6 shrink-0 text-resp-accent" aria-hidden />
        )}
      </div>

      {open && (
        <ul
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          className="absolute inset-x-0 top-full z-10 mt-2 max-h-64 overflow-y-auto rounded-input border border-resp-accent/30 bg-resp-bg p-1 shadow-popover"
        >
          {visible.length === 0 ? (
            <li className="px-3 py-2 text-base opacity-60">No suggestions found</li>
          ) : (
            visible.map((o, i) => (
              <li
                key={o.id}
                id={`${listId}-${o.id}`}
                role="option"
                aria-selected={o.id === value}
                // mousedown + preventDefault keeps focus in the input so blur doesn't close the list first
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o.id);
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx(
                  "flex cursor-pointer items-center justify-between rounded-input px-3 py-2 text-lg text-resp-accent",
                  i === active ? "bg-resp-accent/20" : "bg-resp-accent/5",
                  i > 0 && "mt-1",
                )}
              >
                {o.label || <span className="opacity-60">Choice {options.indexOf(o) + 1}</span>}
                {o.id === value && <Check className="size-5" aria-hidden />}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
