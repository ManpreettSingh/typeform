import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { question } from "./__fixtures__/questions";
import { amountError, buildPaymentProperties, formatAmountInput, formatMoney, parseAmount, type PaymentDraft } from "./payment";
import type { PaymentProperties } from "./types";
import { getDef } from "./questionTypes";
import { validateAnswer } from "./validation";

const ANSWER = {
  payment_id: "pay_Abc123XyZ456",
  order_id: "order_Abc123XyZ456",
  signature: "f".repeat(64),
  amount: 49_900,
  currency: "INR",
};
const PROPS: PaymentProperties = { currency: "INR", description: "", business_name: "", min_amount: 100, max_amount: 10_000_000 };
const def = getDef("payment");

describe("parseAmount: what the respondent typed → minor units (paise, cents)", () => {
  it("reads whole and decimal amounts without floating-point drift", () => {
    assert.equal(parseAmount("499"), 49_900);
    assert.equal(parseAmount("499.5"), 49_950);
    assert.equal(parseAmount("499.50"), 49_950);
    assert.equal(parseAmount("0.1"), 10);
    assert.equal(parseAmount("19.99"), 1_999);
    assert.equal(parseAmount(".5"), 50);
    assert.equal(parseAmount("  250  "), 25_000);
  });

  it("accepts thousands separators", () => {
    assert.equal(parseAmount("1,000"), 100_000);
    assert.equal(parseAmount("1,25,000.75"), 12_500_075);
  });

  it("rejects anything that is not an amount of money", () => {
    for (const bad of ["", " ", "abc", "-5", "1e3", "12.345", "1.2.3", "₹5", "5 rupees", "NaN", "Infinity"]) {
      assert.equal(parseAmount(bad), null, bad);
    }
  });
});

describe("formatMoney (mirrors question_types/payment.py)", () => {
  it("writes the symbol and two decimals", () => {
    assert.equal(formatMoney(49_900, "INR"), "₹499.00");
    assert.equal(formatMoney(15_000_000, "USD"), "$150,000.00");
    assert.equal(formatMoney(5, "EUR"), "€0.05");
    assert.equal(formatMoney(250, "GBP"), "£2.50");
  });
});

describe("formatAmountInput: a stored amount back into the amount field", () => {
  it("drops .00 and keeps two decimals otherwise", () => {
    assert.equal(formatAmountInput(49_900), "499");
    assert.equal(formatAmountInput(49_950), "499.50");
    assert.equal(formatAmountInput(5), "0.05");
  });
});

describe("amountError: the amount field against the creator's limits", () => {
  const props = { ...PROPS, min_amount: 500, max_amount: 100_000 };

  it("asks for an amount when there is none or it is not a number", () => {
    assert.equal(amountError("", props), "Enter an amount");
    assert.equal(amountError("abc", props), "Enter an amount");
  });

  it("names the limit that was broken", () => {
    assert.equal(amountError("4.99", props), "The amount must be at least ₹5.00");
    assert.equal(amountError("1000.01", props), "The amount can't be more than ₹1,000.00");
  });

  it("accepts the limits themselves", () => {
    assert.equal(amountError("5", props), null);
    assert.equal(amountError("1000", props), null);
  });
});

describe("buildPaymentProperties: the builder's fields → what gets saved", () => {
  const draft: PaymentDraft = { currency: "INR", business_name: "Acme", description: "Thanks", suggested: "", min: "1", max: "100000" };
  const base = { ...PROPS, attachment: null } as never;

  it("turns rupees into paise and keeps what it was not asked to change", () => {
    const result = buildPaymentProperties({ ...draft, suggested: "499" }, base);
    assert.deepEqual(result, {
      properties: {
        ...PROPS,
        attachment: null,
        business_name: "Acme",
        description: "Thanks",
        suggested_amount: 49_900,
        min_amount: 100,
        max_amount: 10_000_000,
      },
    });
  });

  it("leaves out the suggested amount when the field is empty", () => {
    const result = buildPaymentProperties(draft, { ...PROPS, suggested_amount: 500 } as never);
    assert.ok("properties" in result);
    assert.equal("suggested_amount" in result.properties, false);
  });

  it("explains what is wrong instead of saving it", () => {
    const error = (fields: Partial<typeof draft>) => {
      const result = buildPaymentProperties({ ...draft, ...fields }, base);
      return "error" in result ? result.error : null;
    };
    assert.equal(error({ min: "" }), "Enter a minimum amount");
    assert.equal(error({ max: "abc" }), "Enter a maximum amount");
    assert.equal(error({ min: "0.5" }), "The minimum amount is ₹1.00");
    assert.equal(error({ max: "600000" }), "The maximum amount is ₹500,000.00");
    assert.equal(error({ min: "50", max: "10" }), "The minimum amount can't be more than the maximum");
    assert.equal(error({ min: "10", max: "100", suggested: "5" }), "The suggested amount must be between the minimum and the maximum");
    assert.equal(error({ suggested: "x" }), "Enter a valid suggested amount, or leave it empty");
    assert.equal(error({ business_name: "x".repeat(81) }), "The business name can be at most 80 characters");
  });
});

describe("payment answers (mirror question_types/payment.py)", () => {
  const q = question("payment", PROPS);

  it("accepts a payment within the limits", () => {
    assert.equal(def.validate(q, ANSWER as never), null);
  });

  it("rejects things that are not a payment", () => {
    const bad = [
      "pay_Abc123XyZ456",
      { ...ANSWER, payment_id: "Abc123" },
      { ...ANSWER, order_id: "pay_Abc123XyZ456" },
      { ...ANSWER, signature: "" },
      { ...ANSWER, amount: 499.5 },
      { ...ANSWER, currency: "USD" },
    ];
    for (const value of bad) assert.equal(def.validate(q, value as never), "Please complete the payment");
  });

  it("holds the amount to the question's limits", () => {
    const limited = question("payment", { ...PROPS, min_amount: 500, max_amount: 1_000 });
    assert.equal(def.validate(limited, { ...ANSWER, amount: 499 } as never), "The amount must be at least ₹5.00");
    assert.equal(def.validate(limited, { ...ANSWER, amount: 1_001 } as never), "The amount can't be more than ₹10.00");
  });

  it("is required even when the question says optional", () => {
    assert.equal(validateAnswer({ ...q, required: false }, undefined), "Please complete the payment");
    assert.equal(validateAnswer({ ...q, required: false }, ANSWER as never), null);
  });

  it("reads as the amount and the payment id in results", () => {
    assert.equal(def.format(q, ANSWER as never), "₹499.00 (pay_Abc123XyZ456)");
  });

  it("offers no branching conditions", () => {
    assert.deepEqual(def.ops, []);
  });
});
