"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useId, useState } from "react";
import { ApiError, getErrorMessage } from "@/lib/api";
import { amountError, formatAmountInput, formatMoney, parseAmount } from "@/lib/payment";
import {
  PaymentCancelled,
  createPaymentOrder,
  isPreviewPayment,
  payWithRazorpay,
  previewPayment,
} from "@/lib/razorpayCheckout";
import { useFormSlug } from "../FormSlugContext";
import type { AnswerProps } from "../types";
import { FIELD_LINE, useAutofocus } from "./shared";

const SYMBOLS = { INR: "₹", USD: "$", EUR: "€", GBP: "£" } as const;

/**
 * Typeform's payment question with a respondent-chosen amount: type what to pay, press Pay, finish in Razorpay's
 * window. Once paid the answer is the proof of payment and the question shows a receipt (a payment can't be undone
 * here). Previews pretend to pay and charge nothing.
 */
export function PaymentAnswer({ question, value, onChange, live, labelledBy }: AnswerProps<"payment">) {
  const slug = useFormSlug();
  const props = question.properties;
  const amountRef = useAutofocus<HTMLInputElement>(live && !value);
  const [raw, setRaw] = useState(() => (props.suggested_amount ? formatAmountInput(props.suggested_amount) : ""));
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hintId = useId();
  const errorId = useId();

  async function pay() {
    const invalid = amountError(raw, props);
    if (invalid) return setError(invalid);
    const amount = parseAmount(raw) as number; // amountError() just confirmed it parses
    setError(null);
    if (!slug) return onChange(previewPayment(amount, props.currency));

    setPaying(true);
    try {
      const order = await createPaymentOrder(slug, question.id, amount);
      onChange(await payWithRazorpay(order));
    } catch (e) {
      if (!(e instanceof PaymentCancelled)) {
        setError(e instanceof ApiError ? getErrorMessage(e) : e instanceof Error ? e.message : "The payment didn't go through. Please try again.");
      }
    } finally {
      setPaying(false);
    }
  }

  if (value) {
    return (
      <div
        role="status"
        className="flex w-full max-w-xl items-center gap-4 rounded-resp-button border border-resp-accent/40 bg-resp-accent/5 p-4 text-resp-accent"
      >
        <CheckCircle2 className="size-8 shrink-0" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-xl font-medium sm:text-2xl">Paid {formatMoney(value.amount, value.currency)}</p>
          <p className="mt-0.5 text-sm break-all opacity-70">
            {isPreviewPayment(value) ? "Preview only, nothing was charged" : `Payment ID ${value.payment_id}`}
          </p>
        </div>
      </div>
    );
  }

  const symbol = SYMBOLS[props.currency];
  return (
    <div className="flex w-full max-w-xl flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span aria-hidden className="text-2xl font-light text-resp-accent/60 sm:text-3xl">
          {symbol}
        </span>
        <input
          ref={amountRef}
          inputMode="decimal"
          autoComplete="off"
          aria-labelledby={labelledBy}
          aria-describedby={error ? errorId : hintId}
          aria-invalid={error ? true : undefined}
          className={`min-w-0 flex-1 ${FIELD_LINE}`}
          placeholder="0.00"
          value={raw}
          disabled={paying}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
            // Enter here pays; it must not also move on to the next question.
            e.preventDefault();
            void pay();
          }}
        />
      </div>
      <p id={hintId} className="text-sm text-resp-accent/70">
        {formatMoney(props.min_amount, props.currency)} to {formatMoney(props.max_amount, props.currency)}
        {props.description ? ` · ${props.description}` : ""}
      </p>
      <div>
        <button
          type="button"
          disabled={paying}
          onClick={() => void pay()}
          // Enter/Space press this button; neither may also move on to the next question.
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.stopPropagation()}
          className="inline-flex items-center gap-2 rounded-resp-button bg-resp-accent px-5 py-2.5 text-base font-semibold text-resp-accent-fg transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent disabled:cursor-wait disabled:opacity-70 sm:text-lg"
        >
          {paying && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {paying ? "Opening payment…" : parseAmount(raw) ? `Pay ${formatMoney(parseAmount(raw) as number, props.currency)}` : "Pay"}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-sm text-resp-error">
          {error}
        </p>
      )}
    </div>
  );
}
