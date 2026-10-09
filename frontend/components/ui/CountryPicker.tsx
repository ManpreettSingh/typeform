"use client";

import { clsx } from "clsx";
import * as Flags from "country-flag-icons/react/3x2";
import { getCountries, getCountryCallingCode, type CountryCode } from "libphonenumber-js";
import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState, type ComponentType, type KeyboardEvent } from "react";

// Not exported from components/ui/index.ts on purpose: it carries every flag, so only the phone question imports it.

const regionNames = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const FLAGS = Flags as unknown as Record<string, ComponentType<{ className?: string }>>;

export function countryName(code: string): string {
  return regionNames?.of(code) ?? code;
}

export function CountryFlag({ country, className }: { country: string; className?: string }) {
  const Flag = FLAGS[country];
  return Flag ? <Flag className={className} /> : <span className={className} />;
}

const COUNTRIES = getCountries()
  .map((code) => ({ code, name: countryName(code), dial: getCountryCallingCode(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

type Props = {
  value: string;
  onChange: (code: CountryCode) => void;
  /** "respondent" is drawn with the form's theme, "panel" with the builder's right-panel look. */
  tone: "respondent" | "panel";
  /** Show the country name beside the flag (the builder's default-country row). */
  showName?: boolean;
  id?: string;
};

const TONES = {
  respondent: {
    trigger:
      "flex items-center gap-1.5 border-b border-resp-accent/30 pb-2 text-resp-accent hover:border-resp-accent focus-visible:border-resp-accent focus-visible:outline-none",
    popover: "border border-resp-text/15 bg-resp-bg text-resp-text",
    row: "data-[active=true]:bg-resp-text/10",
    muted: "text-resp-text/60",
  },
  panel: {
    trigger:
      "flex h-9 w-full items-center gap-2 rounded-field border border-border-strong bg-field px-3 text-sm text-text hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent",
    popover: "border border-border bg-bg text-text",
    row: "data-[active=true]:bg-bg-hover",
    muted: "text-text-muted",
  },
} as const;

/** A flag button that opens a searchable list of countries (name, flag, +dial code). Keyboard friendly. */
export function CountryPicker({ value, onChange, tone, showName, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const t = TONES[tone];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/^\+/, "");
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase() === q || c.dial.startsWith(q));
  }, [query]);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  function toggle() {
    if (!open) {
      setQuery("");
      setActive(Math.max(0, COUNTRIES.findIndex((c) => c.code === value)));
    }
    setOpen((o) => !o);
  }

  function select(code: CountryCode) {
    onChange(code);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (results[active]) select(results[active].code);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === "Tab") {
      setOpen(false);
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Country: ${countryName(value)}, +${getCountryCallingCode(value as CountryCode)}`}
        onClick={toggle}
        className={clsx(t.trigger)}
      >
        <CountryFlag country={value} className="h-4 w-6 shrink-0 rounded-[2px]" />
        {showName && <span className="flex-1 truncate text-left">{countryName(value)}</span>}
        <ChevronDown className="size-4 shrink-0 opacity-60" aria-hidden />
      </button>

      {open && (
        <div className={clsx("absolute top-full left-0 z-50 mt-2 w-72 rounded-card shadow-popover", t.popover)}>
          <label className="flex items-center gap-2 border-b border-current/10 px-3 py-2.5 text-sm">
            <Search className="size-4 shrink-0 opacity-60" aria-hidden />
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-expanded
              aria-controls={listId}
              aria-label="Search countries"
              placeholder="Search"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActive(0);
              }}
              onKeyDown={onKeyDown}
              className="min-w-0 flex-1 bg-transparent focus:outline-none"
            />
          </label>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Countries" className="max-h-64 overflow-y-auto py-1">
            {results.map((c, i) => (
              <li
                key={c.code}
                role="option"
                aria-selected={c.code === value}
                data-active={i === active}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => select(c.code)}
                onPointerMove={() => setActive(i)}
                className={clsx("flex cursor-pointer items-center gap-3 px-3 py-2 text-sm", t.row)}
              >
                <CountryFlag country={c.code} className="h-4 w-6 shrink-0 rounded-[2px]" />
                <span className="flex-1 truncate">{c.name}</span>
                <span className={t.muted}>+{c.dial}</span>
              </li>
            ))}
            {results.length === 0 && <li className={clsx("px-3 py-2 text-sm", t.muted)}>No countries found</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
