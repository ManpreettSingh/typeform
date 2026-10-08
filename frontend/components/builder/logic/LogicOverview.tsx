"use client";

import { AlertTriangle, ArrowRight, GitBranch } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";
import { OP_LABELS } from "@/lib/logic";
import { useBuilderStore } from "@/store/builderStore";
import { questionLabel, ruleProblem, targetLabel, valueLabel } from "./ruleText";

/** Settings → Logic: every jump in the form, in words. Rules are edited per question in the Create view. */
export function LogicOverview({ onEditQuestion }: { onEditQuestion: (id: number) => void }) {
  const questions = useBuilderStore((s) => s.questions);
  const withRules = questions.filter((q) => q.logic?.rules.length);

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-6 p-6 sm:p-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold text-text">Logic jumps</h2>
        <p className="text-sm text-text-muted">
          Send respondents to a later question, or straight to the end, based on their answers. Add rules in the
          Logic section of a question&rsquo;s settings. Jumps only go forward, so a form can never loop.
        </p>
      </div>

      {withRules.length === 0 ? (
        <EmptyState
          className="rounded-card border border-dashed border-border-strong"
          icon={<GitBranch className="size-6" />}
          title="No logic yet"
          description="Every respondent sees the questions in order."
          action={
            questions[0] && (
              <Button size="sm" variant="secondary" onClick={() => onEditQuestion(questions[0].id)}>
                Add logic to a question
              </Button>
            )
          }
        />
      ) : (
        <ul className="flex flex-col gap-4">
          {withRules.map((question) => (
            <li key={question.id} className="flex flex-col gap-3 rounded-card border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-sm font-semibold text-text">{questionLabel(questions, question.id)}</h3>
                <Button size="sm" variant="ghost" onClick={() => onEditQuestion(question.id)}>
                  Edit
                </Button>
              </div>
              <ol className="flex flex-col gap-2">
                {question.logic!.rules.map((rule, i) => {
                  const problem = ruleProblem(questions, question, rule);
                  return (
                    <li key={i} className="flex flex-col gap-1 text-sm text-text">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-text-muted">If the answer {OP_LABELS[rule.op]}</span>
                        <span className="font-medium">{valueLabel(question, rule.value)}</span>
                        <ArrowRight className="size-3.5 text-text-muted" aria-label="then go to" />
                        <span className="font-medium">{targetLabel(questions, rule.to)}</span>
                      </span>
                      {problem && (
                        <span className="flex items-center gap-1.5 text-xs text-danger">
                          <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                          {problem}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
