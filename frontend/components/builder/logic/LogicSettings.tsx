"use client";

import { AlertTriangle, Plus, X } from "lucide-react";
import { useState } from "react";
import { Button, IconButton, Input, Select, type SelectOption } from "@/components/ui";
import { OPS_BY_TYPE, OP_LABELS } from "@/lib/logic";
import { optionLetter } from "@/lib/questionTypes";
import type { LogicOp, LogicRule, LogicTarget, Question } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { isCompleteRule, questionLabel, ruleProblem } from "./ruleText";

const MAX_RULES = 20;
const RULE_TEXT_MAX = 500;
const TEXT_DEBOUNCE_MS = 600;

/** Per-question jump rules ("If answer is X → go to question Y / end"), shown in the question settings. */
export function LogicSettings({ question }: { question: Question }) {
  const questions = useBuilderStore((s) => s.questions);
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  // Half-typed rules (empty text, "-" in a number) stay local until the server would accept them.
  const [draft, setDraft] = useState<LogicRule[] | null>(null);
  const rules = draft ?? question.logic?.rules ?? [];
  const index = questions.findIndex((q) => q.id === question.id);
  const next = questions[index + 1];

  function change(nextRules: LogicRule[], debounceMs = 0) {
    if (!nextRules.every((rule) => isCompleteRule(question.type, rule))) return setDraft(nextRules);
    setDraft(null);
    updateQuestion(question.id, { logic: nextRules.length ? { rules: nextRules } : null }, debounceMs);
  }

  const update = (i: number, patch: Partial<LogicRule>, debounceMs = 0) =>
    change(
      rules.map((rule, j) => (j === i ? { ...rule, ...patch } : rule)),
      debounceMs,
    );

  return (
    <section aria-labelledby="logic-heading" className="flex flex-col gap-4 border-t border-border pt-5">
      <div className="flex flex-col gap-1">
        <h3 id="logic-heading" className="text-sm font-semibold text-text">
          Logic
        </h3>
        <p className="text-xs text-text-muted">
          Jump to a later question, or end the form, depending on the answer. The first matching rule wins.
        </p>
      </div>

      {rules.map((rule, i) => (
        <RuleEditor
          key={i}
          number={i + 1}
          rule={rule}
          question={question}
          questions={questions}
          index={index}
          onChange={(patch, debounceMs) => update(i, patch, debounceMs)}
          onRemove={() => change(rules.filter((_, j) => j !== i))}
        />
      ))}

      {rules.length > 0 && (
        <p className="text-xs text-text-muted">
          Any other answer goes to{" "}
          <span className="font-medium text-text">
            {next ? questionLabel(questions, next.id) : "the end of the form"}
          </span>
        </p>
      )}

      <div>
        <Button
          size="sm"
          variant="secondary"
          leftIcon={<Plus className="size-4" aria-hidden />}
          disabled={rules.length >= MAX_RULES}
          onClick={() => change([...rules, newRule(question, next?.id ?? "end")])}
        >
          Add rule
        </Button>
      </div>
    </section>
  );
}

function newRule(question: Question, to: LogicTarget): LogicRule {
  const op = OPS_BY_TYPE[question.type][0];
  switch (question.type) {
    case "multiple_choice":
    case "dropdown":
      return { op, value: question.properties.options[0]?.id ?? "", to };
    case "yes_no":
      return { op, value: true, to };
    case "rating":
      return { op, value: question.properties.max, to };
    case "number":
      return { op, value: 0, to };
    default:
      return { op, value: "", to };
  }
}

type RuleEditorProps = {
  number: number;
  rule: LogicRule;
  question: Question;
  questions: Question[];
  index: number;
  onChange: (patch: Partial<LogicRule>, debounceMs?: number) => void;
  onRemove: () => void;
};

function RuleEditor({ number, rule, question, questions, index, onChange, onRemove }: RuleEditorProps) {
  const problem = isCompleteRule(question.type, rule) ? ruleProblem(questions, question, rule) : null;
  const ops = OPS_BY_TYPE[question.type];

  // Forward targets, plus the current one if a reorder left it behind (so the select still shows it).
  const targets: SelectOption<string>[] = questions
    .filter((q, i) => i > index || (q.id === rule.to && q.id !== question.id))
    .map((q) => ({
      value: String(q.id),
      label: questions.indexOf(q) > index ? questionLabel(questions, q.id) : `${questionLabel(questions, q.id)} (earlier)`,
    }));
  targets.push({ value: "end", label: "End of form" });

  return (
    <div
      role="group"
      aria-label={`Rule ${number}`}
      className="flex flex-col gap-2.5 rounded-card border border-border bg-bg-subtle p-3"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">If the answer</span>
        <IconButton size="sm" label={`Remove rule ${number}`} icon={<X className="size-4" />} onClick={onRemove} />
      </div>
      {ops.length > 1 && (
        <Select<LogicOp>
          aria-label="Condition"
          value={rule.op}
          options={ops.map((op) => ({ value: op, label: OP_LABELS[op] }))}
          onChange={(op) => onChange({ op })}
        />
      )}
      <ValueEditor rule={rule} question={question} onChange={onChange} />
      <span className="text-xs font-semibold tracking-wide text-text-muted uppercase">Then go to</span>
      <Select<string>
        aria-label="Jump to"
        value={String(rule.to)}
        options={targets}
        onChange={(to) => onChange({ to: to === "end" ? "end" : Number(to) })}
      />
      {problem && (
        <p role="alert" className="flex items-start gap-1.5 text-xs text-danger">
          <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
          {problem}
        </p>
      )}
    </div>
  );
}

function ValueEditor({
  rule,
  question,
  onChange,
}: {
  rule: LogicRule;
  question: Question;
  onChange: RuleEditorProps["onChange"];
}) {
  switch (question.type) {
    case "multiple_choice":
    case "dropdown": {
      const options: SelectOption<string>[] = question.properties.options.map((o, i) => ({
        value: o.id,
        label: `${optionLetter(i)}. ${o.label || `Choice ${i + 1}`}`,
      }));
      if (!options.some((o) => o.value === rule.value)) {
        options.unshift({ value: String(rule.value), label: "Removed choice" });
      }
      return (
        <Select<string>
          aria-label="Choice"
          value={String(rule.value)}
          options={options}
          onChange={(value) => onChange({ value })}
        />
      );
    }
    case "yes_no":
      return (
        <Select<string>
          aria-label="Answer"
          value={String(rule.value)}
          options={[
            { value: "true", label: "Yes" },
            { value: "false", label: "No" },
          ]}
          onChange={(value) => onChange({ value: value === "true" })}
        />
      );
    case "rating":
      return (
        <Select<number>
          aria-label="Rating"
          value={Number(rule.value)}
          options={Array.from({ length: question.properties.max }, (_, i) => ({
            value: i + 1,
            label: String(i + 1),
          }))}
          onChange={(value) => onChange({ value })}
        />
      );
    case "number":
      return (
        <Input
          aria-label="Number"
          type="number"
          inputMode="decimal"
          value={String(rule.value)}
          error={isCompleteRule("number", rule) ? undefined : "Enter a number"}
          onChange={(e) => {
            const raw = e.target.value;
            const n = Number(raw);
            // Keep the raw text while it isn't a number yet; it isn't saved until it is.
            onChange({ value: raw.trim() !== "" && Number.isFinite(n) ? n : raw });
          }}
        />
      );
    default:
      return (
        <Input
          aria-label="Text"
          placeholder="Type a value"
          maxLength={RULE_TEXT_MAX}
          value={String(rule.value)}
          error={isCompleteRule(question.type, rule) ? undefined : "Enter some text"}
          onChange={(e) => onChange({ value: e.target.value }, TEXT_DEBOUNCE_MS)}
        />
      );
  }
}
