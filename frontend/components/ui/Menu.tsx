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
import { createPortal } from "react-dom";

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

export type MenuItem = {
  label: string;
  onSelect: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  /** Extra content at the end of the row, e.g. a check mark. */
  hint?: ReactNode;
  /** Small second line under the label, e.g. "Coming soon". */
  description?: string;
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

  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    if (!open) return;
    if (rootRef.current) setRect(rootRef.current.getBoundingClientRect());
    
    const onPointerDown = (e: PointerEvent) => {
      // Allow clicking inside the portal
      const portalEl = document.getElementById(menuId);
      if (portalEl?.contains(e.target as Node)) return;
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    // The menu is fixed to where its trigger was, so scrolling the page closes it. Scrolling a long menu itself
    // must not: the capture listener also hears the menu's own scroll events.
    const onScroll = (e: Event) => {
      if (document.getElementById(menuId)?.contains(e.target as Node)) return;
      setOpen(false);
    };
    
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("scroll", onScroll, { capture: true });
    
    itemRefs.current.find((el) => el && !el.disabled)?.focus();
    
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", onScroll, { capture: true });
    };
  }, [open, menuId]);

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

  const menuContent = (
    <AnimatePresence>
      {open && rect && (
        <motion.div
          id={menuId}
          role="menu"
          className={clsx(
            "fixed z-50 mt-1 min-w-48 rounded-field border border-border-strong bg-bg p-1 shadow-popover",
            align === "end" ? "origin-top-right" : "origin-top-left",
          )}
          style={{
            top: rect.bottom + 4,
            left: align === "start" ? rect.left : undefined,
            right: align === "end" ? window.innerWidth - rect.right : undefined,
            maxHeight: window.innerHeight - rect.bottom - 16,
            overflowY: "auto"
          }}
          initial={{ opacity: 0, transform: "scale(0.95)" }}
          animate={{ opacity: 1, transform: "scale(1)", transition: { duration: 0.18, ease: EASE_OUT } }}
          exit={{ opacity: 0, transform: "scale(0.95)", transition: { duration: 0.135, ease: EASE_OUT } }}
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
                  close({ restoreFocus: true });
                  item.onSelect();
                }}
                className={clsx(
                  "flex w-full items-center gap-2 px-3 py-2 text-left text-sm",
                  "rounded-input hover:bg-bg-hover focus:bg-bg-hover focus:outline-none",
                  "disabled:cursor-not-allowed disabled:opacity-50",
                  item.danger ? "text-danger" : "text-text",
                )}
              >
                {item.icon}
                <span className="flex flex-1 flex-col">
                  {item.label}
                  {item.description && <span className="text-xs text-text-muted">{item.description}</span>}
                </span>
                {item.hint}
              </button>
            </div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={rootRef} className={clsx("relative inline-block", className)} onKeyDown={onKeyDown}>
      {trigger({
        onClick: () => setOpen((o) => !o),
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": menuId,
      })}
      {typeof document !== "undefined" ? createPortal(menuContent, document.body) : null}
    </div>
  );
}
