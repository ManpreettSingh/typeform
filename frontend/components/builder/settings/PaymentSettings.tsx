"use client";

import { useState } from "react";
import { Input, Select } from "@/components/ui";
import {
  BUSINESS_NAME_MAX,
  DESCRIPTION_MAX,
  buildPaymentProperties,
  formatAmountInput,
  type PaymentDraft,
} from "@/lib/payment";
import { PAYMENT_CURRENCIES, type PaymentCurrency, type QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

const CURRENCIES = PAYMENT_CURRENCIES.map((c) => ({ value: c, label: c }));

/**
 * The payment question's settings. The respondent types what they pay, so the creator sets the currency, what
 * checkout shows, and the smallest / largest amount (plus an optional pre-filled one). Amounts are typed in whole
 * currency units ("499.50") and saved in minor units; nothing that fails the checks is saved.
 */
export function PaymentSettings({ question }: { question: QuestionOf<"payment"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const props = question.properties;
  // Raw text, so a half-typed amount isn't rewritten under the cursor.
  const [draft, setDraft] = useState<PaymentDraft>({
    currency: props.currency,
    business_name: props.business_name,
    description: props.description,
    suggested: props.suggested_amount ? formatAmountInput(props.suggested_amount) : "",
    min: formatAmountInput(props.min_amount),
    max: formatAmountInput(props.max_amount),
  });
  const [error, setError] = useState<string | null>(null);

  function change(patch: Partial<PaymentDraft>) {
    const next = { ...draft, ...patch };
    setDraft(next);
    const result = buildPaymentProperties(next, props);
    if ("error" in result) return setError(result.error);
    setError(null);
    updateQuestion(question.id, { properties: result.properties });
  }

  return (
    <div className="flex flex-col gap-3 pb-2">
      <Select<PaymentCurrency>
        label="Currency"
        options={CURRENCIES}
        value={draft.currency}
        onChange={(currency) => change({ currency })}
      />
      <Input
        label="Business name"
        hint="Shown at the top of the payment window. Defaults to the form title."
        maxLength={BUSINESS_NAME_MAX}
        value={draft.business_name}
        onChange={(e) => change({ business_name: e.target.value })}
      />
      <Input
        label="Description"
        hint="What the payment is for."
        maxLength={DESCRIPTION_MAX}
        value={draft.description}
        onChange={(e) => change({ description: e.target.value })}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input
          label="Minimum"
          inputMode="decimal"
          value={draft.min}
          onChange={(e) => change({ min: e.target.value })}
        />
        <Input
          label="Maximum"
          inputMode="decimal"
          value={draft.max}
          onChange={(e) => change({ max: e.target.value })}
        />
      </div>
      <Input
        label="Suggested amount"
        hint="Optional. Pre-filled for the respondent, who can change it."
        inputMode="decimal"
        placeholder="None"
        value={draft.suggested}
        onChange={(e) => change({ suggested: e.target.value })}
      />
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
