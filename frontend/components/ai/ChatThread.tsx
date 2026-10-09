"use client";

import { clsx } from "clsx";
import { ArrowUp, Sparkles } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui";
import type { Session } from "@/lib/ai/session";

/** The conversation on the left of the review view: messages, a thinking indicator, errors with Try again, the composer. */
export function ChatThread({
  session,
  onSend,
  onRetry,
  onRestore,
}: {
  session: Session;
  onSend: (text: string) => void;
  onRetry: () => void;
  onRestore: (versionIndex: number) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [session.messages.length, session.status]);

  const versionAt = new Map(session.versions.map((v, i) => [v.messageIndex, i]));
  const thinking = session.status === "thinking";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div role="log" aria-label="Conversation" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ol className="flex flex-col gap-4">
          {session.messages.map((m, i) => {
            const version = versionAt.get(i);
            return m.role === "user" ? (
              <li key={i} className="ml-auto max-w-[85%] rounded-2xl bg-bg-hover px-3.5 py-2 text-sm whitespace-pre-wrap text-text">
                {m.content}
              </li>
            ) : (
              <li key={i} className="flex gap-2.5">
                <Avatar />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-5 whitespace-pre-wrap text-text">{m.content}</p>
                  {version !== undefined &&
                    (version === session.current ? (
                      <p className="mt-1.5 text-xs text-text-muted">Version {version + 1} · shown on the right</p>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onRestore(version)}
                        className="mt-1.5 text-xs font-medium text-text underline underline-offset-2 hover:text-text-soft focus-visible:outline-2 focus-visible:outline-accent"
                      >
                        Restore version {version + 1}
                      </button>
                    ))}
                </div>
              </li>
            );
          })}
          {thinking && (
            <li className="flex items-center gap-2.5" role="status" aria-label="Typeform AI is thinking">
              <Avatar />
              <span className="flex items-center gap-1 text-sm text-text-muted">
                Thinking
                <span aria-hidden className="flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="size-1 rounded-full bg-text-muted motion-safe:animate-pulse"
                      style={{ animationDelay: `${d * 160}ms` }}
                    />
                  ))}
                </span>
              </span>
            </li>
          )}
          {session.status === "error" && session.error && (
            <li role="alert" className="rounded-field border border-danger/40 bg-danger-soft px-3 py-2.5 text-sm text-danger">
              <p>{session.error}</p>
              <Button size="sm" variant="secondary" className="mt-2" onClick={onRetry}>
                Try again
              </Button>
            </li>
          )}
        </ol>
        <div ref={bottomRef} />
      </div>
      <Composer disabled={thinking} onSend={onSend} />
    </div>
  );
}

function Avatar() {
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-ai-line bg-ai-halo text-text-muted">
      <Sparkles className="size-3.5" aria-hidden />
    </span>
  );
}

function Composer({ disabled, onSend }: { disabled: boolean; onSend: (text: string) => void }) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !disabled;

  function send(e?: FormEvent) {
    e?.preventDefault();
    if (!canSend) return;
    onSend(text);
    setText("");
  }
  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  return (
    <form onSubmit={send} className="shrink-0 border-t border-border p-3">
      <div className="flex items-end gap-2 rounded-xl border border-ai-line bg-field p-2 focus-within:shadow-[0_0_0_3px_var(--ai-halo)]">
        <textarea
          aria-label="Message Typeform AI"
          rows={1}
          maxLength={4000}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask for a change, e.g. add a phone number question"
          className="field-sizing-content max-h-40 min-h-6 flex-1 resize-none bg-transparent px-1 py-0.5 text-sm leading-5 text-text placeholder:text-text-muted focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!canSend}
          className={clsx(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
            canSend ? "border-primary bg-primary text-primary-fg hover:bg-primary-hover" : "border-border bg-bg-subtle text-text-subtle",
          )}
        >
          <ArrowUp className="size-4" aria-hidden />
        </button>
      </div>
    </form>
  );
}
