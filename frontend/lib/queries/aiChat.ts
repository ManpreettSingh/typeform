import { api, apiGet, apiPut } from "@/lib/api";
import type { AiMemory, ApplyIn, ChatIn, ChatOut } from "@/lib/ai/types";
import type { Form } from "@/lib/types";

/** The Typeform AI chat (Gemini on the server). Nothing is saved until `apply`. */
export const aiChatApi = {
  chat: (body: ChatIn, signal?: AbortSignal) => api<ChatOut>("/ai/chat", { method: "POST", json: body, signal }),
  /** Saves a reviewed proposal; `form_id: null` creates the form. */
  apply: (body: ApplyIn) => api<Form>("/ai/apply", { method: "POST", json: body }),
  memory: () => apiGet<AiMemory>("/ai/memory"),
  saveMemory: (content: string) => apiPut<AiMemory>("/ai/memory", { content }),
};
