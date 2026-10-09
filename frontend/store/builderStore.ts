"use client";

import { toast } from "sonner";
import { create } from "zustand";
import { ApiError, getErrorMessage } from "@/lib/api";
import { formsApi } from "@/lib/queries/forms";
import { questionsApi } from "@/lib/queries/questions";
import { endingsApi } from "@/lib/queries/endings";
import { arrayMove } from "@dnd-kit/sortable";
import type { Form, FormUpdate, Question, QuestionCreate, QuestionType, QuestionUpdate } from "@/lib/types";
import { Autosaver, type SaveStatus } from "./autosave";

export type BuilderForm = Pick<
  Form,
  "id" | "slug" | "title" | "description" | "status" | "response_count" | "theme" | "thank_you" | "welcome" | "endings"
>;

/** Form-level fields edited in the builder and saved through PATCH /forms/{id}. */
type FormSettings = Pick<Form, "title" | "description" | "theme" | "thank_you" | "welcome">;

/** What the canvas shows: the welcome screen, the selected question, or the ending (thank-you screen). */
export type BuilderScreen = "welcome" | "question" | "ending";

/** Fields a new question can start with (type and position are handled by the store). */
type QuestionInit = Omit<QuestionCreate, "type" | "position">;

type LoadState = { status: "idle" | "loading" | "ready" | "error"; error: ApiError | null };

type BuilderState = {
  load: LoadState;
  form: BuilderForm | null;
  questions: Question[];
  selectedId: number | null;
  selectedEndingId: number | null;
  screen: BuilderScreen;
  saveStatus: SaveStatus;
  /** Last server-confirmed values, used to roll back failed saves. */
  savedSettings: FormSettings;
  savedQuestions: Record<number, Question>;
};

type BuilderActions = {
  loadForm: (formId: number) => Promise<void>;
  /** Selects a question and shows it on the canvas. */
  select: (id: number) => void;
  selectEnding: (id: number) => void;
  showScreen: (screen: BuilderScreen) => void;
  /** Local update + debounced PATCH of title / description / theme / thank_you. */
  updateForm: (patch: Partial<FormSettings>, debounceMs?: number) => void;
  setTitle: (title: string) => void;
  commitTitle: () => void;
  /** Inserts after the selected question (or appends) and selects it. */
  addQuestion: (type: QuestionType, init?: QuestionInit) => Promise<void>;
  /** Copies a question (not its logic) right below it. */
  duplicateQuestion: (id: number) => Promise<void>;
  updateQuestion: (id: number, patch: QuestionUpdate, debounceMs?: number) => void;
  deleteQuestion: (id: number) => Promise<void>;
  /** Moves `activeId` to `overId`'s slot (drag and drop) and saves the new order. */
  moveQuestion: (activeId: number, overId: number) => void;
  addEnding: () => Promise<void>;
  updateEnding: (id: number, patch: Partial<Form["endings"][number]>, debounceMs?: number) => void;
  duplicateEnding: (id: number) => Promise<void>;
  deleteEnding: (id: number) => Promise<void>;
  moveEnding: (activeId: number, overId: number) => void;
  applyServerForm: (form: Form) => void;
  flush: () => Promise<void>;
  hasUnsavedChanges: () => boolean;
};

const TEXT_DEBOUNCE_MS = 600;
const STRUCTURE_KEY = "structure";
const FORM_KEY = "form";
const questionKey = (id: number) => `q:${id}`;

const renumber = (questions: Question[]) => questions.map((q, i) => (q.position === i ? q : { ...q, position: i }));

function withoutJumpsTo(question: Question, id: number): Question {
  const rules = question.logic?.rules.filter((rule) => rule.to !== id);
  if (!rules || rules.length === question.logic?.rules.length) return question;
  return { ...question, logic: rules.length ? { rules } : null };
}

const withLogicOf = (question: Question, saved: Question | undefined): Question =>
  saved ? { ...question, logic: saved.logic } : question;

const toMeta = ({ id, slug, title, description, status, response_count, theme, thank_you, welcome, endings }: Form): BuilderForm => ({
  id,
  slug,
  title,
  description,
  status,
  response_count,
  theme,
  thank_you,
  welcome,
  endings,
});

const settingsOf = ({ title, description, theme, thank_you, welcome }: Form): FormSettings => ({ title, description, theme, thank_you, welcome });

const reportFailure = (what: string, error: unknown) => toast.error(`${what} ${getErrorMessage(error)}`);

let loadToken = 0;

export const useBuilderStore = create<BuilderState & BuilderActions>()((set, get) => {
  const saver = new Autosaver((saveStatus) => set({ saveStatus }));

  /** After a failed reorder, put questions back in the server's order (keeping local edits). */
  async function restoreServerOrder(formId: number) {
    const server = await formsApi.get(formId).catch(() => null);
    if (!server) return;
    const position = new Map(server.questions.map((q) => [q.id, q.position]));
    const rank = (q: Question) => position.get(q.id) ?? Number.MAX_SAFE_INTEGER;
    set((s) => ({ questions: renumber([...s.questions].sort((a, b) => rank(a) - rank(b))) }));
  }

  return {
    load: { status: "idle", error: null },
    form: null,
    questions: [],
    selectedId: null,
    selectedEndingId: null,
    screen: "question",
    saveStatus: "saved",
    savedSettings: { title: "", description: null, theme: {} as Form["theme"], thank_you: {} as Form["thank_you"], welcome: {} as Form["welcome"] },
    savedQuestions: {},

    async loadForm(formId) {
      const token = ++loadToken;
      const sameForm = get().form?.id === formId;
      // Re-showing the same form refreshes in the background; switching forms shows the skeleton.
      if (!sameForm) {
        set({ load: { status: "loading", error: null }, form: null, questions: [], selectedId: null, selectedEndingId: null, screen: "question" });
      }

      await saver.flushAll();
      try {
        const form = await formsApi.get(formId);
        // Ignore stale responses, and don't clobber edits made while the request was in flight.
        if (token !== loadToken || (sameForm && saver.busy)) return;
        const keep = get().selectedId;
        set({
          load: { status: "ready", error: null },
          form: toMeta(form),
          questions: form.questions,
          savedSettings: settingsOf(form),
          savedQuestions: Object.fromEntries(form.questions.map((q) => [q.id, q])),
          selectedId: form.questions.some((q) => q.id === keep) ? keep : (form.questions[0]?.id ?? null),
        });
      } catch (error) {
        if (token !== loadToken) return;
        const apiError = error instanceof ApiError ? error : new ApiError(0, getErrorMessage(error));
        set({ load: { status: "error", error: apiError } });
      }
    },

    select(id) {
      set({ selectedId: id, screen: "question" });
    },

    showScreen(screen) {
      set({ screen });
    },

    updateForm(patch, debounceMs = TEXT_DEBOUNCE_MS) {
      const form = get().form;
      if (!form) return;
      set({ form: { ...form, ...patch } });

      const toSend: FormUpdate = { ...patch };
      if (patch.title !== undefined) {
        // A form always needs a title: while the field is blank, keep (re)sending the last saved one.
        toSend.title = patch.title.trim() || get().savedSettings.title;
      }
      saver.queue(
        FORM_KEY,
        toSend,
        async (pending) => {
          try {
            const saved = await formsApi.update(form.id, pending);
            // Local values are left alone so e.g. trimming doesn't fight the cursor while typing.
            set({ savedSettings: settingsOf(saved) });
          } catch (error) {
            saver.cancel(FORM_KEY);
            set((s) => ({ form: s.form && { ...s.form, ...s.savedSettings } }));
            reportFailure("Couldn't save the form settings.", error);
            throw error;
          }
        },
        debounceMs,
      );
    },

    setTitle(title) {
      get().updateForm({ title });
    },

    commitTitle() {
      const { form, savedSettings } = get();
      if (!form) return;
      const trimmed = form.title.trim();
      // Blank reverts to the last saved title; otherwise drop surrounding spaces.
      const title = trimmed || savedSettings.title;
      if (title !== form.title) set({ form: { ...form, title } });
      void saver.flush(FORM_KEY);
    },

    async addQuestion(type, init = {}) {
      const { form, questions, selectedId, screen } = get();
      if (!form) return;
      // Insert after the selected question, like Typeform; from the welcome screen, insert first; otherwise append.
      const selectedIndex = questions.findIndex((q) => q.id === selectedId);
      const position =
        screen === "welcome" ? 0 : selectedIndex === -1 || screen === "ending" ? questions.length : selectedIndex + 1;

      await saver.now(STRUCTURE_KEY, async () => {
        try {
          const created = await questionsApi.create(form.id, { ...init, type, position });
          set((s) => {
            const next = [...s.questions];
            next.splice(Math.min(created.position, next.length), 0, created);
            return {
              questions: renumber(next),
              savedQuestions: { ...s.savedQuestions, [created.id]: created },
              selectedId: created.id,
              screen: "question",
            };
          });
        } catch (error) {
          reportFailure("Couldn't add the question.", error);
          throw error;
        }
      });
    },

    async duplicateQuestion(id) {
      const source = get().questions.find((q) => q.id === id);
      if (!source) return;
      // Pending edits to the source go out first, so the copy matches what the creator sees.
      await saver.flush(questionKey(id));
      set({ selectedId: id, screen: "question" });
      const { type, title, description, required, properties } = source;
      await get().addQuestion(type, { title, description, required, properties });
    },

    updateQuestion(id, patch, debounceMs = TEXT_DEBOUNCE_MS) {
      set((s) => ({ questions: s.questions.map((q) => (q.id === id ? ({ ...q, ...patch } as Question) : q)) }));

      const key = questionKey(id);
      saver.queue(
        key,
        patch,
        async (pending) => {
          try {
            const saved = await questionsApi.update(id, pending);
            set((s) => ({ savedQuestions: { ...s.savedQuestions, [id]: saved } }));
          } catch (error) {
            saver.cancel(key);
            set((s) => {
              const saved = s.savedQuestions[id];
              return { questions: s.questions.map((q) => (q.id === id ? withLogicOf(saved ?? q, saved) : q)) };
            });
            reportFailure("Couldn't save the question.", error);
            throw error;
          }
        },
        debounceMs,
      );
    },

    selectEnding(id) {
      set({ selectedEndingId: id, screen: "ending" });
    },

    async addEnding() {
      const { form } = get();
      if (!form) return;
      await saver.now(STRUCTURE_KEY, async () => {
        try {
          const created = await endingsApi.create(form.id, { title: "New ending", message: "" });
          set((s) => {
            if (!s.form) return {};
            return {
              form: { ...s.form, endings: [...s.form.endings, created] },
              selectedEndingId: created.id,
              screen: "ending",
            };
          });
        } catch (error) {
          reportFailure("Couldn't add the ending.", error);
          throw error;
        }
      });
    },

    updateEnding(id, patch, debounceMs = TEXT_DEBOUNCE_MS) {
      set((s) => {
        if (!s.form) return {};
        return {
          form: {
            ...s.form,
            endings: s.form.endings.map((e) => (e.id === id ? { ...e, ...patch } : e)),
          },
        };
      });

      const key = `e:${id}`;
      saver.queue(
        key,
        patch,
        async (pending) => {
          try {
            await endingsApi.update(id, pending);
          } catch (error) {
            saver.cancel(key);
            reportFailure("Couldn't save the ending.", error);
            // Needs local rollback? The whole form is fetched anyway when reloading
            throw error;
          }
        },
        debounceMs,
      );
    },

    async duplicateEnding(id) {
      const source = get().form?.endings.find((e) => e.id === id);
      const formId = get().form?.id;
      if (!source || !formId) return;
      await saver.flush(`e:${id}`);
      set({ selectedEndingId: id, screen: "ending" });
      await saver.now(STRUCTURE_KEY, async () => {
        try {
          const created = await endingsApi.create(formId, { title: source.title, message: source.message, button_text: source.button_text, button_url: source.button_url });
          set((s) => {
            if (!s.form) return {};
            const next = [...s.form.endings];
            next.splice(source.position + 1, 0, created);
            return {
              form: { ...s.form, endings: next.map((e, i) => ({ ...e, position: i })) },
              selectedEndingId: created.id,
              screen: "ending",
            };
          });
          // Fix positions server-side
          const newOrder = get().form!.endings.map(e => e.id);
          await endingsApi.reorder(formId, newOrder);
        } catch (error) {
          reportFailure("Couldn't duplicate the ending.", error);
          throw error;
        }
      });
    },

    async deleteEnding(id) {
      const form = get().form;
      if (!form) return;
      if (form.endings.length <= 1) {
        toast.error("A form must have at least one ending.");
        return;
      }
      const position = form.endings.find((e) => e.id === id)?.position ?? 0;
      set((s) => {
        if (!s.form) return {};
        return { form: { ...s.form, endings: s.form.endings.filter((e) => e.id !== id) } };
      });
      const remaining = get().form!.endings;
      const nextSelected = remaining[Math.min(position, remaining.length - 1)].id;
      if (get().selectedEndingId === id) get().selectEnding(nextSelected);

      await saver.now(STRUCTURE_KEY, async () => {
        try {
          await endingsApi.delete(id);
        } catch (error) {
          reportFailure("Couldn't delete the ending.", error);
          const server = await formsApi.get(form.id).catch(() => null);
          if (server) set({ form: toMeta(server) });
          throw error;
        }
      });
    },

    moveEnding(activeId, overId) {
      const form = get().form;
      if (!form || activeId === overId) return;
      
      const oldIndex = form.endings.findIndex((e) => e.id === activeId);
      const newIndex = form.endings.findIndex((e) => e.id === overId);
      if (oldIndex === -1 || newIndex === -1) return;
      
      const nextEndings = arrayMove(form.endings, oldIndex, newIndex).map((e, i) => ({ ...e, position: i }));
      set((s) => s.form ? { form: { ...s.form, endings: nextEndings } } : {});

      saver.queue(
        STRUCTURE_KEY,
        {}, // dummy
        async () => {
          try {
            await endingsApi.reorder(form.id, nextEndings.map((e) => e.id));
          } catch (error) {
            reportFailure("Couldn't reorder endings.", error);
            const server = await formsApi.get(form.id).catch(() => null);
            if (server) set({ form: toMeta(server) });
            throw error;
          }
        },
        500
      );
    },


    async deleteQuestion(id) {
      const { questions, selectedId } = get();
      const index = questions.findIndex((q) => q.id === id);
      if (index === -1) return;
      const removed = questions[index];
      // The server also drops other questions' jumps to it; mirror that so the logic panel stays accurate.
      const remaining = renumber(questions.filter((q) => q.id !== id).map((q) => withoutJumpsTo(q, id)));

      saver.cancel(questionKey(id));
      set({
        questions: remaining,
        selectedId: selectedId === id ? (remaining[Math.min(index, remaining.length - 1)]?.id ?? null) : selectedId,
      });

      await saver.now(STRUCTURE_KEY, async () => {
        try {
          await saver.flush(questionKey(id)); // let an in-flight edit finish first
          await questionsApi.remove(id);
          set((s) => {
            const savedQuestions: Record<number, Question> = {};
            for (const [key, q] of Object.entries(s.savedQuestions)) {
              if (Number(key) !== id) savedQuestions[Number(key)] = withoutJumpsTo(q, id);
            }
            return { savedQuestions };
          });
          toast.success("Question deleted");
        } catch (error) {
          set((s) => {
            // Put the question and the jumps to it back (the server kept both).
            const next = s.questions.map((q) => withLogicOf(q, s.savedQuestions[q.id]));
            next.splice(index, 0, s.savedQuestions[id] ?? removed);
            return { questions: renumber(next) };
          });
          reportFailure("Couldn't delete the question.", error);
          throw error;
        }
      });
    },

    moveQuestion(activeId, overId) {
      const { questions } = get();
      const from = questions.findIndex((q) => q.id === activeId);
      const to = questions.findIndex((q) => q.id === overId);
      if (from === -1 || to === -1 || from === to) return;
      set({ questions: renumber(arrayMove(questions, from, to)) });

      void saver.now(STRUCTURE_KEY, async () => {
        const { form } = get();
        if (!form) return;
        try {
          // Send the order as it is when this runs, so queued moves/adds/deletes all line up.
          await questionsApi.reorder(form.id, get().questions.map((q) => q.id));
        } catch (error) {
          await restoreServerOrder(form.id);
          reportFailure("Couldn't reorder questions.", error);
          throw error;
        }
      });
    },

    applyServerForm(form) {
      set((s) => ({ form: s.form && { ...s.form, status: form.status, slug: form.slug } }));
    },

    flush: () => saver.flushAll(),

    hasUnsavedChanges: () => saver.busy,
  };
});
