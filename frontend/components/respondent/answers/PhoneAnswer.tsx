"use client";

import { AsYouType, getCountryCallingCode, getExampleNumber, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import examples from "libphonenumber-js/examples.mobile.json";
import { useState } from "react";
import { CountryPicker } from "@/components/ui/CountryPicker";
import type { AnswerProps } from "../types";
import { FIELD, submitOnEnter, useAutofocus } from "./shared";

/** What the answer holds while typing: "+<dial code><digits>", so the server always reads it as international. */
const withDialCode = (country: CountryCode, digits: string) =>
  digits ? `+${getCountryCallingCode(country)}${digits}` : undefined;

/**
 * Typeform's phone input: a flag button with a searchable country list, then the number, formatted as you type.
 * Pasting a number that starts with "+" picks the country for you.
 */
export function PhoneAnswer({ question, value, onChange, onSubmit, live, labelledBy }: AnswerProps<"phone_number">) {
  const ref = useAutofocus<HTMLInputElement>(live);
  const initial = value ? parsePhoneNumberFromString(value) : undefined;
  const [country, setCountry] = useState<CountryCode>(initial?.country ?? (question.properties.default_country as CountryCode));
  const [text, setText] = useState(initial?.country ? new AsYouType(initial.country).input(initial.nationalNumber) : "");

  const example = getExampleNumber(country, examples)?.formatNational();
  const digitsOf = (s: string) => s.replace(/\D/g, "");

  function changeCountry(next: CountryCode) {
    const digits = digitsOf(text);
    setCountry(next);
    setText(new AsYouType(next).input(digits));
    onChange(withDialCode(next, digits));
    ref.current?.focus();
  }

  function changeText(raw: string) {
    if (raw.trim().startsWith("+")) {
      const pasted = parsePhoneNumberFromString(raw);
      if (pasted?.country) {
        setCountry(pasted.country);
        setText(new AsYouType(pasted.country).input(pasted.nationalNumber));
        onChange(pasted.number);
        return;
      }
    }
    const digits = digitsOf(raw);
    setText(new AsYouType(country).input(digits));
    onChange(withDialCode(country, digits));
  }

  return (
    <div className="flex items-end gap-3">
      <CountryPicker value={country} onChange={changeCountry} tone="respondent" />
      <input
        ref={ref}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        aria-labelledby={labelledBy}
        className={FIELD}
        placeholder={example || "Phone number"}
        value={text}
        onChange={(e) => changeText(e.target.value)}
        onKeyDown={submitOnEnter(onSubmit)}
      />
    </div>
  );
}
