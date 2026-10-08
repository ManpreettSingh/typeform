import { Heart, Star } from "lucide-react";
import { QuestionTypeChip } from "@/components/builder/QuestionTypeChip";
import { formatNumber } from "@/lib/answerFormat";
import type { ChoiceSummary, NumberSummary, Question, QuestionSummary, RatingSummary, TextSummary } from "@/lib/types";
import { BarList } from "./BarList";

type Props = {
  summary: QuestionSummary;
  question: Question | undefined;
  number: number;
  /** Completed responses, the denominator for "answered". */
  completed: number;
  onShowResponses: () => void;
};

/** One question's results: header with answer count, then a type-specific body. */
export function QuestionSummaryCard({ summary, question, number, completed, onShowResponses }: Props) {
  const skipped = completed - summary.answered;
  return (
    <article className="rounded-card border border-border bg-bg p-5 sm:p-6">
      <header className="flex items-start gap-3">
        <QuestionTypeChip type={summary.type} />
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold break-words text-text">
            <span className="mr-1.5 text-text-muted">{number}.</span>
            {summary.title.trim() || <span className="text-text-muted">Untitled question</span>}
          </h3>
          <p className="mt-0.5 text-sm text-text-muted">
            {summary.answered} of {completed} answered
            {skipped > 0 && ` · ${skipped} skipped`}
          </p>
        </div>
      </header>

      <div className="mt-5">
        {summary.answered === 0 ? (
          <p className="rounded-input bg-bg-subtle px-4 py-6 text-center text-sm text-text-muted">No answers yet</p>
        ) : (
          <SummaryBody summary={summary} question={question} onShowResponses={onShowResponses} />
        )}
      </div>
    </article>
  );
}

function SummaryBody({
  summary,
  question,
  onShowResponses,
}: {
  summary: QuestionSummary;
  question: Question | undefined;
  onShowResponses: () => void;
}) {
  switch (summary.type) {
    case "multiple_choice":
    case "dropdown":
    case "yes_no":
      return <ChoiceBody summary={summary} multiple={question?.type === "multiple_choice" && question.properties.allow_multiple} />;
    case "rating":
      return <RatingBody summary={summary} shape={question?.type === "rating" ? question.properties.shape : "number"} />;
    case "number":
      return <NumberBody summary={summary} />;
    default:
      return <TextBody summary={summary} onShowResponses={onShowResponses} />;
  }
}

function ChoiceBody({ summary, multiple }: { summary: ChoiceSummary; multiple: boolean }) {
  const items = summary.counts.map((c, i) => ({
    key: c.option_id,
    label: c.label || <span className="text-text-muted">Choice {i + 1}</span>,
    count: c.count,
  }));
  return (
    <>
      <BarList items={items} total={summary.answered} />
      {multiple && (
        <p className="mt-4 text-xs text-text-muted">Respondents could pick more than one, so totals can exceed 100%.</p>
      )}
    </>
  );
}

function RatingBody({ summary, shape }: { summary: RatingSummary; shape: "star" | "heart" | "number" }) {
  const Icon = shape === "heart" ? Heart : shape === "star" ? Star : null;
  // Highest first, like review summaries.
  const items = Array.from({ length: summary.max }, (_, i) => summary.max - i).map((step) => ({
    key: String(step),
    label: (
      <span className="inline-flex items-center gap-1 tabular-nums">
        {step}
        {Icon && <Icon className="size-3.5 text-text-muted" aria-label={shape === "heart" ? "hearts" : "stars"} />}
      </span>
    ),
    count: summary.distribution[String(step)] ?? 0,
  }));

  return (
    <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
      <Figure label={`Average out of ${summary.max}`} value={summary.average === null ? "–" : summary.average.toFixed(1)} />
      <BarList items={items} total={summary.answered} />
    </div>
  );
}

function NumberBody({ summary }: { summary: NumberSummary }) {
  const show = (n: number | null) => (n === null ? "–" : formatNumber(n));
  return (
    <div className="grid grid-cols-3 gap-3">
      <Figure label="Lowest" value={show(summary.min)} />
      <Figure label="Average" value={show(summary.average)} />
      <Figure label="Highest" value={show(summary.max)} />
    </div>
  );
}

function TextBody({ summary, onShowResponses }: { summary: TextSummary; onShowResponses: () => void }) {
  return (
    <>
      <ul className="flex flex-col gap-2">
        {summary.recent.map((text, i) => (
          <li
            key={i}
            className="rounded-input bg-bg-subtle px-3 py-2 text-sm break-words whitespace-pre-line text-text"
          >
            {text}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        {summary.answered > summary.recent.length ? `Latest ${summary.recent.length} of ${summary.answered}. ` : ""}
        <button type="button" onClick={onShowResponses} className="font-medium text-accent hover:underline">
          See all responses
        </button>
      </p>
    </>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-input bg-bg-subtle px-4 py-3">
      <p className="text-2xl font-semibold text-text sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{label}</p>
    </div>
  );
}
