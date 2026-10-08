"use client";

import { clsx } from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { IconButton } from "./IconButton";

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  /** "xl" for wide pickers (Add content). */
  size?: "md" | "xl";
  /** Replaces the default title row (the title stays the dialog's accessible name). */
  header?: ReactNode;
  bodyClassName?: string;
  /** Give focus back to what had it before opening (default). Off when the dialog's action moves focus itself. */
  restoreFocus?: boolean;
};

const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const noopSubscribe = () => () => {};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
  header,
  bodyClassName,
  restoreFocus = true,
}: ModalProps) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  // Portals need `document`; false during SSR, true after hydration.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);

  // Read at close time, so the decision can be made by the action that closes the dialog. A layout effect, so it's
  // already updated when the open-effect's cleanup (a passive effect) runs in the same commit.
  const restoreFocusRef = useRef(restoreFocus);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
    restoreFocusRef.current = restoreFocus;
  });

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";

    // Focus the first form field if present, else the panel itself.
    const panel = panelRef.current;
    const field = panel?.querySelector<HTMLElement>("input, textarea, select");
    (field ?? panel)?.focus();

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      if (restoreFocusRef.current) previouslyFocused?.focus();
    };
  }, [open]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, transition: { duration: 0.24 } }}
            exit={{ opacity: 0, transition: { duration: 0.18 } }}
            onClick={onClose}
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={clsx(
              "relative w-full rounded-modal bg-bg shadow-modal focus:outline-none",
              size === "xl" ? "max-w-5xl" : "max-w-md",
            )}
            // Centered (not trigger-anchored), from 0.96: 240ms in, 180ms out (motion review, round 4).
            initial={{ opacity: 0, transform: "scale(0.96)" }}
            animate={{ opacity: 1, transform: "scale(1)", transition: { duration: 0.24, ease: EASE_OUT } }}
            exit={{ opacity: 0, transform: "scale(0.96)", transition: { duration: 0.18, ease: EASE_OUT } }}
          >
            {header ? (
              <>
                <h2 id={titleId} className="sr-only">
                  {title}
                </h2>
                {header}
              </>
            ) : (
              <div className="flex items-center justify-between px-6 pt-5">
                <h2 id={titleId} className="text-lg font-semibold text-text">
                  {title}
                </h2>
                <IconButton label="Close" icon={<X className="size-4" />} size="sm" onClick={onClose} />
              </div>
            )}
            <div className={bodyClassName ?? "px-6 py-4 text-sm text-text-muted"}>{children}</div>
            {footer && <div className="flex justify-end gap-2 px-6 pb-5">{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
