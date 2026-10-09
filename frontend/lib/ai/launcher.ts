import { create } from "zustand";

/**
 * Lets any screen open Typeform AI's review view in the workspace with a ready-made request (the onboarding's
 * "Create my first form with AI"). The workspace sidebar owns the view and reads this.
 */
export const useAiLauncher = create<{ prompt: string | null; launch: (prompt: string) => void; clear: () => void }>()((set) => ({
  prompt: null,
  launch: (prompt) => set({ prompt }),
  clear: () => set({ prompt: null }),
}));
