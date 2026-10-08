"use client";

import { useCallback, useSyncExternalStore } from "react";

export type WorkspaceView = "list" | "grid";

const KEY = "workspace-view";
const listeners = new Set<() => void>();

function read(): WorkspaceView {
  try {
    return localStorage.getItem(KEY) === "grid" ? "grid" : "list";
  } catch {
    return "list";
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** List (Typeform's default) or Grid, remembered per browser. */
export function useWorkspaceView(): [WorkspaceView, (view: WorkspaceView) => void] {
  const view = useSyncExternalStore<WorkspaceView>(subscribe, read, () => "list");
  const setView = useCallback((next: WorkspaceView) => {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Storage blocked: the choice still applies until reload.
    }
    listeners.forEach((l) => l());
  }, []);
  return [view, setView];
}
