// Razorpay Checkout in the browser. The server opens the order (POST /public/forms/{slug}/payments/order, which also
// checks the amount against the question's limits); this file loads Razorpay's checkout.js, opens the payment window
// and turns what it returns into the form's answer. The server asks Razorpay again before it accepts the response.
import { apiPost } from "./api";
import type { PaymentAnswer, PaymentCurrency } from "./types";

export type PaymentOrder = {
  order_id: string;
  /** Razorpay's public key id; the secret stays on the server. */
  key_id: string;
  amount: number;
  currency: PaymentCurrency;
  name: string;
  description: string;
};

export const createPaymentOrder = (slug: string, questionId: number, amount: number) =>
  apiPost<PaymentOrder>(`/public/forms/${encodeURIComponent(slug)}/payments/order`, {
    question_id: questionId,
    amount,
  });

type CheckoutResult = { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string };
type CheckoutOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  handler: (result: CheckoutResult) => void;
  modal: { ondismiss: () => void };
  theme?: { color: string };
};

declare global {
  interface Window {
    Razorpay?: new (options: CheckoutOptions) => { open: () => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
let loading: Promise<void> | null = null;

function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      loading = null; // let the next attempt try again
      script.remove();
      reject(new Error("We couldn't open the payment window. Check your connection and try again."));
    };
    document.head.append(script);
  });
  return loading;
}

/** The respondent closed the payment window without paying. Not an error worth showing. */
export class PaymentCancelled extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "PaymentCancelled";
  }
}

/** Opens Razorpay Checkout for `order`; resolves with the answer once the respondent has paid. */
export async function payWithRazorpay(order: PaymentOrder, accentColor?: string): Promise<PaymentAnswer> {
  await loadCheckout();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("We couldn't open the payment window. Please try again.");

  return new Promise<PaymentAnswer>((resolve, reject) => {
    new Razorpay({
      key: order.key_id,
      order_id: order.order_id,
      amount: order.amount,
      currency: order.currency,
      name: order.name,
      description: order.description,
      handler: (result) =>
        resolve({
          payment_id: result.razorpay_payment_id,
          order_id: result.razorpay_order_id,
          signature: result.razorpay_signature,
          amount: order.amount,
          currency: order.currency,
        }),
      modal: { ondismiss: () => reject(new PaymentCancelled()) },
      ...(accentColor ? { theme: { color: accentColor } } : {}),
    }).open();
  });
}

/** Previews (builder, full preview) have no published form to pay on: a pretend payment, nothing is charged. */
export function previewPayment(amount: number, currency: PaymentCurrency): PaymentAnswer {
  return {
    payment_id: "pay_PreviewOnly0000",
    order_id: "order_PreviewOnly0000",
    signature: "0".repeat(64),
    amount,
    currency,
  };
}

export const isPreviewPayment = (answer: PaymentAnswer) => answer.payment_id === "pay_PreviewOnly0000";
