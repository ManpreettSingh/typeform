"use client";

import { Button } from "@/components/ui";
import { AiPromptBox } from "./AiPromptBox";

/** What a blank form shows on Typeform: the AI prompt box, then "Start from scratch" (which opens Add content). */
export function AiStartScreen({ onSubmit, onStartFromScratch }: { onSubmit: (prompt: string) => void; onStartFromScratch: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 rounded-card bg-canvas px-6 py-10">
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="text-sm font-medium text-text-muted">Typeform AI</p>
        <h2 className="text-2xl/8 font-normal text-text">What would you like to create?</h2>
      </div>
      <AiPromptBox autoFocus onSubmit={onSubmit} />
      <div className="flex w-[432px] max-w-full justify-center border-t border-border pt-5">
        <div className="w-[216px] rounded-xl bg-bg-hover/40 p-1.5">
          <Button variant="ghost" className="w-full" onClick={onStartFromScratch}>
            Start from scratch
          </Button>
        </div>
      </div>
    </div>
  );
}
