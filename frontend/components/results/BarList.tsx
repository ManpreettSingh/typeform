import type { ReactNode } from "react";

export type BarItem = { key: string; label: ReactNode; count: number };

export function percentOf(count: number, total: number): number {
  return total > 0 ? Math.round((count / total) * 100) : 0;
}

/**
 * Single-series horizontal bars: one hue, label + count + % in text colors, bar width = share of `total`.
 * Every value is printed, so the bars need no axis or tooltip to be read.
 */
export function BarList({ items, total }: { items: BarItem[]; total: number }) {
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => {
        const pct = percentOf(item.count, total);
        return (
          <li key={item.key} className="flex flex-col gap-1.5">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 break-words text-text">{item.label}</span>
              <span className="shrink-0 text-text-muted tabular-nums">
                <span className="font-semibold text-text">{pct}%</span>
                <span className="ml-2">
                  {item.count} {item.count === 1 ? "response" : "responses"}
                </span>
              </span>
            </div>
            <div aria-hidden className="h-3 w-full rounded-r-input bg-bg-subtle">
              {item.count > 0 && (
                <div
                  className="h-full min-w-1 rounded-r-input bg-accent transition-[width] duration-300 ease-out"
                  style={{ width: `${pct}%` }}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
