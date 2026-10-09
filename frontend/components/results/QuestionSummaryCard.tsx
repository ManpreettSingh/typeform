import { Heart, Star } from "lucide-react";
import { QuestionTypeChip } from "@/components/builder/QuestionTypeChip";
import { formatNumber } from "@/lib/answerFormat";
import type {
  ChoiceSummary,
  MatrixSummary,
  NpsSummary,
  NumberSummary,
  Question,
  QuestionSummary,
  RankingSummary,
  RatingSummary,
  RatingShape,
  ScaleSummary,
  TextSummary,
} from "@/lib/types";
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
    case "legal":
    case "checkbox":
      return <ChoiceBody summary={summary} multiple={question?.type === "multiple_choice" && question.properties.allow_multiple} />;
    case "rating":
      return <RatingBody summary={summary} shape={question?.type === "rating" ? question.properties.shape : "number"} />;
    case "opinion_scale":
      return <ScaleBody summary={summary} />;
    case "nps":
      return <NpsBody summary={summary} />;
    case "number":
      return <NumberBody summary={summary} />;
    case "ranking":
      return <RankingBody summary={summary} />;
    case "matrix":
      return <MatrixBody summary={summary} />;
    default:
      return <TextBody summary={summary as TextSummary} onShowResponses={onShowResponses} />;
  }
}

function RankingBody({ summary }: { summary: RankingSummary }) {
  const ranks = Object.values(summary.ranks || {}).sort((a, b) => a.average - b.average);
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[auto_1fr_auto] gap-x-4 gap-y-2 text-sm">
        <div className="font-semibold text-text-muted">Rank</div>
        <div className="font-semibold text-text-muted">Option</div>
        <div className="font-semibold text-text-muted text-right">Avg</div>
        {ranks.map((r, i) => (
          <div key={r.option_id} className="contents border-t border-border/50 py-1">
            <div className="font-medium text-text">{i + 1}</div>
            <div className="text-text">{r.label}</div>
            <div className="text-right text-text-muted">{r.average.toFixed(2)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MatrixBody({ summary }: { summary: MatrixSummary }) {
  const rows = Object.values(summary.rows || {});
  return (
    <div className="flex flex-col gap-8">
      {rows.map((r) => (
        <div key={r.question_id} className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-text">{r.title}</h4>
          <BarList 
            items={r.counts.map((c) => ({
              key: c.option_id,
              label: c.label,
              count: c.count
            }))} 
            total={r.answered} 
          />
        </div>
      ))}
    </div>
  );
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

function RatingBody({ summary, shape }: { summary: RatingSummary; shape: RatingShape }) {
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

/** Every step of an opinion scale with its count, highest first, and the average. */
function ScaleBody({ summary }: { summary: ScaleSummary }) {
  const items = Array.from({ length: summary.max - summary.min + 1 }, (_, i) => summary.max - i).map((step) => ({
    key: String(step),
    label: <span className="tabular-nums">{step}</span>,
    count: summary.distribution[String(step)] ?? 0,
  }));
  return (
    <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
      <Figure label="Average" value={summary.average === null ? "–" : summary.average.toFixed(1)} />
      <BarList items={items} total={summary.answered} />
    </div>
  );
}

const NPS_GROUPS = [
  { key: "promoters", label: "Promoters", range: "9–10", bar: "bg-success" },
  { key: "passives", label: "Passives", range: "7–8", bar: "bg-border-strong" },
  { key: "detractors", label: "Detractors", range: "0–6", bar: "bg-danger" },
] as const;

/** The score, the three groups (as a split bar and as counts) and how many picked each step. */
function NpsBody({ summary }: { summary: NpsSummary }) {
  const items = Array.from({ length: 11 }, (_, i) => 10 - i).map((step) => ({
    key: String(step),
    label: <span className="tabular-nums">{step}</span>,
    count: summary.distribution[String(step)] ?? 0,
  }));
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <Figure label="Net Promoter Score" value={summary.score === null ? "–" : String(summary.score)} />
        <div className="flex flex-col justify-center gap-3">
          <div aria-hidden className="flex h-3 overflow-hidden rounded-r-input bg-bg-subtle">
            {NPS_GROUPS.map(({ key, bar }) => (
              <div key={key} className={bar} style={{ width: `${summary[key].percent}%` }} />
            ))}
          </div>
          <ul className="grid grid-cols-3 gap-3 text-sm">
            {NPS_GROUPS.map(({ key, label, range, bar }) => (
              <li key={key} className="flex flex-col">
                <span className="flex items-center gap-1.5 text-text-muted">
                  <span aria-hidden className={`size-2 rounded-full ${bar}`} />
                  {label} <span className="tabular-nums">({range})</span>
                </span>
                <span className="font-semibold text-text tabular-nums">{summary[key].percent}%</span>
                <span className="text-xs text-text-muted tabular-nums">
                  {summary[key].count} {summary[key].count === 1 ? "response" : "responses"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
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
  const recent = summary.answers.slice(0, 5);
  return (
    <>
      <ul className="flex flex-col gap-2">
        {recent.map((answer, i) => (
          <li
            key={i}
            className="rounded-input bg-bg-subtle px-3 py-2 text-sm break-words whitespace-pre-line text-text"
          >
            {answer.value}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-muted">
        {summary.answered > recent.length ? `Latest ${recent.length} of ${summary.answered}. ` : ""}
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
