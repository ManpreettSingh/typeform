// Payment questions: money maths and the amount field. Mirrors backend/app/question_types/payment.py; the server
// stays authoritative (it also asks Razorpay whether the money really arrived, services/payments.py).
import { PAYMENT_AMOUNT_RANGE, type PaymentAnswer, type PaymentCurrency, type PaymentProperties } from "./types";

export const PAYMENT_ERROR = "Please complete the payment";
const SYMBOLS: Record<PaymentCurrency, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£" };

const moneyFormat = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 49900 + INR → "₹499.00". Every supported currency has two decimals. */
export function formatMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency as PaymentCurrency] ?? `${currency} `;
  return `${symbol}${moneyFormat.format(amount / 100)}`;
}

/** A stored amount back into the amount field: "499", or "499.50" when there are paise. */
export function formatAmountInput(amount: number): string {
  const whole = Math.floor(amount / 100);
  const minor = amount % 100;
  return minor === 0 ? String(whole) : `${whole}.${String(minor).padStart(2, "0")}`;
}

/**
 * What the respondent typed → minor units, or null when it isn't an amount of money. Works on the digits rather
 * than multiplying a float, so 19.99 is exactly 1999. Thousands commas are allowed, more than two decimals aren't.
 */
export function parseAmount(raw: string): number | null {
  const match = /^(\d+)?(?:\.(\d{1,2}))?$/.exec(raw.trim().replace(/,/g, ""));
  if (!match || (match[1] === undefined && match[2] === undefined)) return null;
  const whole = Number(match[1] ?? "0");
  const minor = Number((match[2] ?? "").padEnd(2, "0"));
  const amount = whole * 100 + minor;
  return Number.isSafeInteger(amount) ? amount : null;
}

type Limits = Pick<PaymentProperties, "currency" | "min_amount" | "max_amount">;

/** Error for the amount field against the creator's limits, or null when it can be paid. */
export function amountError(raw: string, limits: Limits): string | null {
  const amount = parseAmount(raw);
  if (amount === null || amount === 0) return "Enter an amount";
  return limitError(amount, limits);
}

function limitError(amount: number, { currency, min_amount, max_amount }: Limits): string | null {
  if (amount < min_amount) return `The amount must be at least ${formatMoney(min_amount, currency)}`;
  if (amount > max_amount) return `The amount can't be more than ${formatMoney(max_amount, currency)}`;
  return null;
}

export const BUSINESS_NAME_MAX = 80;
export const DESCRIPTION_MAX = 255;

/** The builder's text fields (amounts in rupees/dollars as typed). */
export type PaymentDraft = {
  currency: PaymentCurrency;
  business_name: string;
  description: string;
  suggested: string;
  min: string;
  max: string;
};

/**
 * The builder's fields → the question's properties, or what is wrong with them. Nothing invalid is ever saved, so the
 * server's own checks (schemas/properties.py PaymentProperties) only catch what this misses.
 */
export function buildPaymentProperties(
  draft: PaymentDraft,
  base: PaymentProperties,
): { properties: PaymentProperties } | { error: string } {
  const { currency } = draft;
  const { min: floor, max: ceiling } = PAYMENT_AMOUNT_RANGE;

  if (draft.business_name.length > BUSINESS_NAME_MAX) return { error: `The business name can be at most ${BUSINESS_NAME_MAX} characters` };
  if (draft.description.length > DESCRIPTION_MAX) return { error: `The description can be at most ${DESCRIPTION_MAX} characters` };

  const min = parseAmount(draft.min);
  if (min === null) return { error: "Enter a minimum amount" };
  if (min < floor) return { error: `The minimum amount is ${formatMoney(floor, currency)}` };
  const max = parseAmount(draft.max);
  if (max === null) return { error: "Enter a maximum amount" };
  if (max > ceiling) return { error: `The maximum amount is ${formatMoney(ceiling, currency)}` };
  if (min > max) return { error: "The minimum amount can't be more than the maximum" };

  let suggested: number | undefined;
  if (draft.suggested.trim() !== "") {
    const parsed = parseAmount(draft.suggested);
    if (parsed === null) return { error: "Enter a valid suggested amount, or leave it empty" };
    if (parsed < min || parsed > max) return { error: "The suggested amount must be between the minimum and the maximum" };
    suggested = parsed;
  }

  const properties: PaymentProperties = {
    ...base,
    currency,
    business_name: draft.business_name,
    description: draft.description,
    min_amount: min,
    max_amount: max,
  };
  // Clearing the field removes the suggestion.
  if (suggested === undefined) delete properties.suggested_amount;
  else properties.suggested_amount = suggested;
  return { properties };
}

const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;
const ORDER_ID = /^order_[A-Za-z0-9]{6,40}$/;
const SIGNATURE = /^[0-9a-f]{64}$/;

/** Error for a stored answer, or null. */
export function validatePayment(value: unknown, limits: Limits): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return PAYMENT_ERROR;
  const { payment_id, order_id, signature, amount, currency } = value as Partial<PaymentAnswer>;
  if (typeof payment_id !== "string" || !PAYMENT_ID.test(payment_id)) return PAYMENT_ERROR;
  if (typeof order_id !== "string" || !ORDER_ID.test(order_id)) return PAYMENT_ERROR;
  if (typeof signature !== "string" || !SIGNATURE.test(signature)) return PAYMENT_ERROR;
  if (!Number.isInteger(amount) || currency !== limits.currency) return PAYMENT_ERROR;
  return limitError(amount as number, limits);
}
