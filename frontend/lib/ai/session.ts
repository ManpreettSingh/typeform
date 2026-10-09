// State of one Typeform AI conversation: messages, the proposals it produced (so an earlier one can be restored) and the
// request state. Pure, so the whole behavior is tested without a browser (session.test.ts).
import type { AiMessage, ChatOut, Diff, Proposal } from "./types";

/** The server accepts up to 4000 characters per message and 40 messages; stay under both. */
export const MESSAGE_MAX = 4000;
export const MAX_SERVER_MESSAGES = 30;

export type Version = {
  proposal: Proposal;
  diff: Diff;
  reply: string;
  /** Index in `messages` of the assistant message that made this proposal. */
  messageIndex: number;
};
export type SessionStatus = "idle" | "thinking" | "error";
export type Session = {
  messages: AiMessage[];
  /** Every proposal the AI made, oldest first. Restoring one makes it current; a new proposal then branches from it. */
  versions: Version[];
  /** Index into `versions` of the proposal shown and applied; -1 before the first one. */
  current: number;
  status: SessionStatus;
  error: string | null;
};

export const initialSession: Session = { messages: [], versions: [], current: -1, status: "idle", error: null };

export type SessionAction =
  | { type: "send"; text: string }
  | { type: "reply"; out: ChatOut }
  | { type: "fail"; message: string }
  | { type: "retry" }
  | { type: "restore"; index: number };

export function sessionReducer(state: Session, action: SessionAction): Session {
  switch (action.type) {
    case "send": {
      const text = action.text.trim();
      if (!text || state.status === "thinking") return state;
      return { ...state, messages: [...state.messages, { role: "user", content: text }], status: "thinking", error: null };
    }
    case "reply": {
      const { out } = action;
      const messages: AiMessage[] = [...state.messages, { role: "assistant", content: out.reply }];
      if (!out.proposal || !out.diff) return { ...state, messages, status: "idle", error: null };
      const version = { proposal: out.proposal, diff: out.diff, reply: out.reply, messageIndex: messages.length - 1 };
      const versions = [...state.versions.slice(0, state.current + 1), version];
      return { messages, versions, current: versions.length - 1, status: "idle", error: null };
    }
    case "fail":
      return { ...state, status: "error", error: action.message };
    case "retry":
      if (state.status !== "error" || state.messages.at(-1)?.role !== "user") return state;
      return { ...state, status: "thinking", error: null };
    case "restore":
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.versions.length) return state;
      return { ...state, current: action.index };
  }
}

export const currentVersion = (s: Session): Version | null => s.versions[s.current] ?? null;

export function isEmptyDiff(d: Diff): boolean {
  return !(d.to_remove.length || d.to_set.length || d.endings.to_remove.length || d.endings.to_set.length || d.welcome.length);
}

/** Whether Apply would change the saved form. */
export const hasChanges = (s: Session): boolean => {
  const v = currentVersion(s);
  return v !== null && !isEmptyDiff(v.diff);
};

/** The latest part of the conversation in the shape the server accepts: starts and ends with the creator. */
export function messagesForServer(messages: AiMessage[]): AiMessage[] {
  const recent = messages.slice(-MAX_SERVER_MESSAGES).map((m) => ({ ...m, content: m.content.slice(0, MESSAGE_MAX) }));
  while (recent.length > 1 && recent[0].role !== "user") recent.shift();
  return recent;
}
