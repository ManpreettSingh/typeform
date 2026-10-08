import type { FormSummary, Question } from "@/lib/types";
import { QuestionSummaryCard } from "./QuestionSummaryCard";

type Props = {
  summary: FormSummary;
  questions: Question[];
  onShowResponses: () => void;
};

export function SummaryView({ summary, questions, onShowResponses }: Props) {
  const byId = new Map(questions.map((q) => [q.id, q]));
  const partial = summary.total_responses - summary.completed;

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Totals" className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Responses" value={summary.completed.toLocaleString("en")} hint="Completed submissions" />
        <StatTile
          label="Completion rate"
          value={`${Math.round(summary.completion_rate * 100)}%`}
          hint={`${summary.completed} of ${summary.total_responses} started`}
        />
        <StatTile label="In progress" value={partial.toLocaleString("en")} hint="Started, not submitted" />
      </section>

      {summary.questions.map((q, i) => (
        <QuestionSummaryCard
          key={q.question_id}
          summary={q}
          question={byId.get(q.question_id)}
          number={i + 1}
          completed={summary.completed}
          onShowResponses={onShowResponses}
        />
      ))}
    </div>
  );
}

function StatTile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-card border border-border bg-bg px-5 py-4">
      <p className="text-sm text-text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold text-text">{value}</p>
      <p className="mt-1 text-xs text-text-muted">{hint}</p>
    </div>
  );
}
