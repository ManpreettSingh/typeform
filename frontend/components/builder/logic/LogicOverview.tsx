"use client";

import { clsx } from "clsx";
import {
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  CornerDownRight,
  GitBranch,
  LayoutList,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import { Button, EmptyState } from "@/components/ui";
import { opLabel } from "@/lib/logic";
import { useBuilderStore } from "@/store/builderStore";
import { QuestionTypeChip } from "../QuestionTypeChip";
import { questionLabel, ruleProblem, targetLabel, valueLabel } from "./ruleText";

type ViewMode = "flow" | "list";

/**
 * Workflow tab: visual logic map of questions and branches, plus a rule list view.
 */
export function LogicOverview({ onEditQuestion }: { onEditQuestion: (id: number) => void }) {
  const [viewMode, setViewMode] = useState<ViewMode>("flow");
  const form = useBuilderStore((s) => s.form);
  const questions = useBuilderStore((s) => s.questions);
  const welcome = form?.welcome;
  const endings = form?.endings ?? [];

  const questionsWithRules = questions.filter((q) => q.logic?.rules.length);
  const totalRules = questionsWithRules.reduce((acc, q) => acc + (q.logic?.rules.length ?? 0), 0);

  if (questions.length === 0) {
    return (
      <section className="mx-auto flex max-w-2xl flex-col items-center justify-center p-8 sm:p-14">
        <EmptyState
          className="w-full rounded-card border border-dashed border-border-strong py-12"
          icon={<GitBranch className="size-8" />}
          title="No questions in workflow"
          description="Add questions in the Content tab to see your form flow and configure logic jumps."
        />
      </section>
    );
  }

  return (
    <section className="mx-auto flex max-w-3xl flex-col gap-6 p-4 sm:p-8">
      {/* Header with summary stats and mode switcher */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-5">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold text-text">Workflow</h2>
            <span className="rounded-full bg-bg-hover px-2.5 py-0.5 text-xs font-medium text-text-muted">
              {questions.length} {questions.length === 1 ? "question" : "questions"}
            </span>
            {totalRules > 0 && (
              <span className="rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                {totalRules} {totalRules === 1 ? "jump" : "jumps"}
              </span>
            )}
          </div>
          <p className="text-sm text-text-muted">
            Visualize respondent progression, conditional branching, and form endings.
          </p>
        </div>

        {/* View mode toggle */}
        <div role="group" aria-label="Workflow view" className="flex items-center rounded-field bg-bg-hover p-1 self-start sm:self-auto">
          <button
            type="button"
            aria-pressed={viewMode === "flow"}
            onClick={() => setViewMode("flow")}
            className={clsx(
              "flex items-center gap-1.5 rounded-input px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "flow" ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            <GitBranch className="size-3.5" aria-hidden />
            Flow map
          </button>
          <button
            type="button"
            aria-pressed={viewMode === "list"}
            onClick={() => setViewMode("list")}
            className={clsx(
              "flex items-center gap-1.5 rounded-input px-3 py-1.5 text-xs font-medium transition-colors",
              viewMode === "list" ? "bg-bg text-text shadow-sm" : "text-text-muted hover:text-text",
            )}
          >
            <LayoutList className="size-3.5" aria-hidden />
            Rule list
          </button>
        </div>
      </div>

      {viewMode === "flow" ? (
        /* Visual Flow Map */
        <div className="flex flex-col items-center">
          {/* Welcome Screen Node (if present) */}
          {welcome && (
            <>
              <div className="w-full max-w-xl rounded-card border border-border bg-bg p-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-6 items-center justify-center rounded-input bg-accent/10 text-accent">
                      <Sparkles className="size-3.5" />
                    </span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Welcome Screen</span>
                  </div>
                </div>
                <p className="mt-2 text-sm font-medium text-text">{form?.title || "Welcome"}</p>
                {form?.description && (
                  <p className="mt-0.5 text-xs text-text-muted line-clamp-1">{form.description}</p>
                )}
              </div>
              <Connector label="Starts form" />
            </>
          )}

          {/* Sequential Question Nodes */}
          {questions.map((question, index) => {
            const rules = question.logic?.rules ?? [];
            const isLast = index === questions.length - 1;

            return (
              <div key={question.id} className="flex w-full flex-col items-center">
                <div
                  className={clsx(
                    "group relative w-full max-w-xl rounded-card border bg-bg p-4.5 shadow-xs transition-shadow hover:shadow-md",
                    rules.length > 0 ? "border-accent/40" : "border-border",
                  )}
                >
                  {/* Top Bar: Number, Type, Title, Edit Button */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-input bg-text text-xs font-semibold text-bg">
                        {index + 1}
                      </span>
                      <QuestionTypeChip type={question.type} />
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-text">
                          {question.title.trim() || "(Untitled question)"}
                          {question.required && <span className="ml-1 text-danger">*</span>}
                        </h3>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="shrink-0 text-xs"
                      onClick={() => onEditQuestion(question.id)}
                    >
                      Edit
                    </Button>
                  </div>

                  {/* Rules / Branching */}
                  {rules.length > 0 ? (
                    <div className="mt-3.5 flex flex-col gap-2 rounded-card bg-bg-hover/60 p-3">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
                        <GitBranch className="size-3.5 text-accent" />
                        <span>Logic branches ({rules.length}):</span>
                      </div>
                      <ul className="flex flex-col gap-1.5 pl-1">
                        {rules.map((rule, rIdx) => {
                          const problem = ruleProblem(questions, question, rule);
                          return (
                            <li key={rIdx} className="flex flex-col gap-0.5 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5 text-text">
                                <span className="font-medium text-text-muted">
                                  If answer {opLabel(question.type, rule.op)}:
                                </span>
                                <span className="rounded bg-bg px-1.5 py-0.5 font-medium shadow-xs">
                                  {valueLabel(question, rule.value)}
                                </span>
                                <ArrowRight className="size-3 text-text-muted" />
                                <span className="rounded bg-accent/10 px-1.5 py-0.5 font-semibold text-accent">
                                  {targetLabel(questions, rule.to)}
                                </span>
                              </div>
                              {problem && (
                                <div className="mt-0.5 flex items-center gap-1 text-xs text-danger">
                                  <AlertTriangle className="size-3" />
                                  <span>{problem}</span>
                                </div>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                      <div className="mt-1 flex items-center gap-1 border-t border-border/60 pt-2 text-xs text-text-muted">
                        <CornerDownRight className="size-3" />
                        <span>
                          Otherwise &rarr;{" "}
                          <strong className="text-text">
                            {isLast ? "End of form" : `${index + 2}. ${questions[index + 1]?.title.trim() || "Next question"}`}
                          </strong>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs text-text-muted">
                      <CheckCircle2 className="size-3 text-text-muted" />
                      <span>
                        Default path &rarr; {isLast ? "Proceeds to Endings" : `Proceeds to question ${index + 2}`}
                      </span>
                    </div>
                  )}
                </div>

                {/* Connector Arrow */}
                <Connector label={isLast ? "Completes form" : undefined} />
              </div>
            );
          })}

          {/* Endings Screen Nodes */}
          <div className="flex w-full max-w-xl flex-col gap-3">
            {endings.length > 0 ? (
              endings.map((ending, eIdx) => (
                <div key={ending.id} className="rounded-card border border-border bg-bg p-4 shadow-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="flex size-6 items-center justify-center rounded-input bg-success/15 text-xs font-semibold text-success">
                        ✓
                      </span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        Ending {endings.length > 1 ? eIdx + 1 : ""}
                      </span>
                    </div>
                  </div>
                  <p className="mt-2 text-sm font-medium text-text">{ending.title || "Thank you for completing this form"}</p>
                  {ending.button_text && (
                    <p className="mt-0.5 text-xs text-text-muted">Button: &ldquo;{ending.button_text}&rdquo;</p>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-card border border-border bg-bg p-4 shadow-xs text-center text-sm text-text-muted">
                End of Form
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Rule List View */
        <div className="flex flex-col gap-4">
          {questionsWithRules.length === 0 ? (
            <EmptyState
              className="rounded-card border border-dashed border-border-strong py-10"
              icon={<GitBranch className="size-6" />}
              title="No logic rules defined"
              description="All respondents see every question sequentially in order."
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
              {questionsWithRules.map((question) => (
                <li key={question.id} className="flex flex-col gap-3 rounded-card border border-border bg-bg p-4 shadow-xs">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <QuestionTypeChip type={question.type} />
                      <h3 className="text-sm font-semibold text-text">{questionLabel(questions, question.id)}</h3>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => onEditQuestion(question.id)}>
                      Edit
                    </Button>
                  </div>
                  <ol className="flex flex-col gap-2 rounded-card bg-bg-hover/50 p-3">
                    {question.logic!.rules.map((rule, i) => {
                      const problem = ruleProblem(questions, question, rule);
                      return (
                        <li key={i} className="flex flex-col gap-1 text-sm text-text">
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="text-text-muted">If the answer {opLabel(question.type, rule.op)}</span>
                            <span className="font-medium rounded bg-bg px-1.5 py-0.5 shadow-xs">
                              {valueLabel(question, rule.value)}
                            </span>
                            <ArrowRight className="size-3.5 text-text-muted" aria-label="then go to" />
                            <span className="font-semibold text-accent rounded bg-accent/10 px-1.5 py-0.5">
                              {targetLabel(questions, rule.to)}
                            </span>
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
        </div>
      )}
    </section>
  );
}

function Connector({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-1">
      <div className="h-4 w-px bg-border-strong" />
      <div className="flex size-5 items-center justify-center rounded-full bg-border-strong text-text-muted">
        <ArrowDown className="size-3" />
      </div>
      {label && <span className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</span>}
      <div className="h-4 w-px bg-border-strong" />
    </div>
  );
}
