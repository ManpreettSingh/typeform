"use client";

import { clsx } from "clsx";
import { Monitor, RotateCcw, Smartphone } from "lucide-react";
import { useMemo, useState } from "react";
import { RespondentFlow } from "@/components/respondent/RespondentFlow";
import { RespondentTheme } from "@/components/respondent/RespondentTheme";
import { Button, IconButton } from "@/components/ui";
import { proposalToPreview } from "@/lib/ai/preview";
import type { Proposal } from "@/lib/ai/types";
import type { Theme } from "@/lib/types";

/** The proposed form, playable like the builder's preview. Answers are never saved. */
export function ProposalPreview({ proposal, theme, versionKey }: { proposal: Proposal; theme: Theme; versionKey: number }) {
  const preview = useMemo(() => proposalToPreview(proposal), [proposal]);
  const [run, setRun] = useState(0);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4">
      <div className="flex shrink-0 items-center justify-between">
        <div className="flex items-center rounded-md border border-border bg-bg p-0.5">
          <IconButton
            size="sm"
            label="Desktop view"
            aria-pressed={device === "desktop"}
            icon={<Monitor className="size-4" />}
            onClick={() => setDevice("desktop")}
            className={device === "desktop" ? "bg-bg-hover text-text" : ""}
          />
          <IconButton
            size="sm"
            label="Mobile view"
            aria-pressed={device === "mobile"}
            icon={<Smartphone className="size-4" />}
            onClick={() => setDevice("mobile")}
            className={device === "mobile" ? "bg-bg-hover text-text" : ""}
          />
        </div>
        <Button size="sm" variant="secondary" leftIcon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setRun((r) => r + 1)}>
          Restart
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 items-stretch justify-center">
        <div
          className={clsx(
            "h-full w-full overflow-hidden bg-bg ring-1 ring-border transition-all duration-300",
            device === "mobile" ? "max-h-[812px] max-w-[375px] rounded-[2rem] ring-8 ring-black/20" : "rounded-lg",
          )}
        >
          <RespondentTheme theme={theme} className="flex h-full flex-col">
            <RespondentFlow
              key={`${versionKey}-${run}`}
              questions={preview.questions}
              thankYou={preview.thankYou}
              welcome={preview.welcome}
              endings={preview.endings}
            />
          </RespondentTheme>
        </div>
      </div>
    </div>
  );
}
