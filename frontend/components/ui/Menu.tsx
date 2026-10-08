"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Draws a divider above this item. */
  separatorBefore?: boolean;
};

export type MenuTriggerProps = {
  onClick: () => void;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
};

export type MenuProps = {
  /** Renders the trigger; spread the given props onto a button. */
  trigger: (props: MenuTriggerProps) => ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
  className?: string;
};

export function Menu({ trigger, items, align = "end", className }: MenuProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // Next's <Activity> keeps hidden routes mounted; don't come back to an open menu.
  useLayoutEffect(() => () => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    itemRefs.current.find((el) => el && !el.disabled)?.focus();
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false);
    if (restoreFocus) rootRef.current?.querySelector<HTMLElement>('[aria-haspopup="menu"]')?.focus();
  }

  function focusItem(from: number, step: 1 | -1) {
    for (let i = 1; i <= items.length; i++) {
      const el = itemRefs.current[(from + step * i + items.length) % items.length];
      if (el && !el.disabled) return el.focus();
    }
  }

  function onKeyDown(e: KeyboardEvent) {
    if (!open) return;
    const current = itemRefs.current.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "Escape") {
      e.stopPropagation();
      close({ restoreFocus: true });
    }
    if (e.key === "Tab") close({ restoreFocus: false });
    if (e.key === "ArrowDown") {
      e.preventDefault();
      focusItem(current, 1);
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      focusItem(current === -1 ? 0 : current, -1);
    }
  }

  return (
    <div ref={rootRef} className={clsx("relative inline-block", className)} onKeyDown={onKeyDown}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
      })}
      <AnimatePresence>
        {open && (
          <motion.div
            id={menuId}
            role="menu"
            className={clsx(
              "absolute z-40 mt-1 min-w-48 rounded-card border border-border bg-bg py-1 shadow-popover",
              align === "end" ? "right-0" : "left-0",
            )}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
          >
            {items.map((item, i) => (
              <div key={item.label}>
                {item.separatorBefore && <div role="separator" className="my-1 border-t border-border" />}
                <button
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    // Restore focus first so a dialog opened by onSelect returns focus to the trigger.
                    close({ restoreFocus: true });
                    item.onSelect();
                  }}
                  className={clsx(
                    "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                    "hover:bg-bg-subtle focus:bg-bg-subtle focus:outline-none",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    item.danger ? "text-danger" : "text-text",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
