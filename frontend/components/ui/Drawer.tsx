"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Extra controls in the header, left of the close button. */
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
};

const noopSubscribe = () => () => {};

/** Side panel from the right for details (e.g. one response). Escape and the backdrop close it. */
export function Drawer({ open, onClose, title, actions, children, footer }: DrawerProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const reduceMotion = useReducedMotion();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // A dialog opened on top (e.g. a delete confirm) owns Escape while it has focus.
      const active = document.activeElement;
      if (active && active !== document.body && !panelRef.current?.contains(active)) return;
      onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-40 flex justify-end">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="relative flex h-full w-full max-w-lg flex-col bg-bg shadow-modal focus:outline-none"
            initial={{ x: reduceMotion ? 0 : "100%", opacity: reduceMotion ? 0 : 1 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: reduceMotion ? 0 : "100%", opacity: reduceMotion ? 0 : 1 }}
            transition={{ duration: 0.25, ease: [0.33, 1, 0.68, 1] }}
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4 sm:px-5">
              <h2 id={titleId} className="min-w-0 flex-1 truncate text-base font-semibold text-text">
                {title}
              </h2>
              {actions}
              <IconButton label="Close" icon={<X className="size-4" />} onClick={onClose} />
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">{children}</div>
            {footer && (
              <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-4 py-3 sm:px-5">
                {footer}
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
