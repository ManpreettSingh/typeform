// First-visit onboarding: what we remember about the visitor, with no accounts. The profile lives in localStorage only.
// Everything read back is re-validated, so edited or corrupt storage can't put junk in the UI. Pure, so it is tested
// without a browser (onboarding.test.ts).

export const ONBOARDING_STORAGE_KEY = "typeform-clone:onboarding";
const VERSION = 1;
const NAME_MAX = 40;
const GOALS_MAX = 3;
const DEFAULT_NAME = "Default creator";

/** Typeform's own "role" filters from its template gallery. `audience` completes "Create a … for ___". */
export const ROLES = [
  { id: "marketing", label: "Marketing", audience: "a marketing team" },
  { id: "product", label: "Product", audience: "a product team" },
  { id: "sales", label: "Sales", audience: "a sales team" },
  { id: "hr", label: "HR", audience: "an HR team" },
  { id: "cs", label: "Customer success", audience: "a customer success team" },
  { id: "founder", label: "Founder", audience: "my startup" },
  { id: "education", label: "Student or educator", audience: "my class" },
  { id: "other", label: "Other", audience: "my project" },
] as const;

/** Typeform's "goal" filters. `phrase` names the form to create. */
export const GOALS = [
  { id: "feedback", label: "Get feedback", phrase: "customer feedback survey" },
  { id: "sales", label: "Make sales", phrase: "product order form" },
  { id: "events", label: "Plan events", phrase: "event registration form" },
  { id: "research", label: "Conduct research", phrase: "market research survey" },
  { id: "engage", label: "Engage my audience", phrase: "fun quiz" },
  { id: "recruit", label: "Recruit talent", phrase: "job application form" },
  { id: "leads", label: "Generate leads", phrase: "lead generation form" },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];
export type GoalId = (typeof GOALS)[number]["id"];

export type OnboardingState =
  | { status: "unseen" }
  | { status: "skipped"; completedAt: string }
  | { status: "completed"; completedAt: string; name: string; role: RoleId | null; goals: GoalId[] };
export type SavedOnboarding = Exclude<OnboardingState, { status: "unseen" }>;

const UNSEEN: OnboardingState = { status: "unseen" };
const roleIds = new Set<string>(ROLES.map((r) => r.id));
const goalIds = new Set<string>(GOALS.map((g) => g.id));

const cleanName = (value: unknown): string =>
  typeof value === "string" ? Array.from(value.trim().replace(/\s+/g, " ")).slice(0, NAME_MAX).join("") : "";
const cleanRole = (value: unknown): RoleId | null => (typeof value === "string" && roleIds.has(value) ? (value as RoleId) : null);
const cleanGoals = (value: unknown): GoalId[] => {
  if (!Array.isArray(value)) return [];
  const goals = value.filter((g): g is GoalId => typeof g === "string" && goalIds.has(g));
  return [...new Set(goals)].slice(0, GOALS_MAX);
};

/** The finished profile; without a usable name there is nothing to personalize, so it counts as skipped. */
export function completedProfile(input: { name: string; role: string | null; goals: readonly string[] }, now: Date = new Date()): SavedOnboarding {
  const name = cleanName(input.name);
  const completedAt = now.toISOString();
  if (!name) return { status: "skipped", completedAt };
  return { status: "completed", completedAt, name, role: cleanRole(input.role), goals: cleanGoals(input.goals) };
}

export function serializeOnboarding(state: SavedOnboarding): string {
  return JSON.stringify({ v: VERSION, ...state });
}

/** Anything unexpected (missing, corrupt, another version, wrong shape) means "not seen yet". */
export function parseOnboarding(raw: string | null): OnboardingState {
  if (!raw) return UNSEEN;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return UNSEEN;
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return UNSEEN;
  const o = data as Record<string, unknown>;
  if (o.v !== VERSION) return UNSEEN;
  const completedAt = typeof o.completedAt === "string" ? o.completedAt : "";
  if (o.status === "skipped") return { status: "skipped", completedAt };
  if (o.status === "completed") {
    const name = cleanName(o.name);
    if (!name) return UNSEEN;
    return { status: "completed", completedAt, name, role: cleanRole(o.role), goals: cleanGoals(o.goals) };
  }
  return UNSEEN;
}

// ---- names ---------------------------------------------------------------------------------------------------------

/** One or two characters for the avatar: first + last word, or the first two letters of a single word. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "DC";
  const first = (w: string) => Array.from(w)[0];
  const text = words.length > 1 ? first(words[0]) + first(words[words.length - 1]) : Array.from(words[0]).slice(0, 2).join("");
  return text.toUpperCase();
}

export const displayName = (state: OnboardingState): string => (state.status === "completed" ? state.name : DEFAULT_NAME);
export const avatarLetter = (state: OnboardingState): string => (state.status === "completed" ? initialsOf(state.name)[0] : "D");
export const avatarInitials = (state: OnboardingState): string => (state.status === "completed" ? initialsOf(state.name) : "DC");

/** A first request for Typeform AI that fits what the visitor told us. */
export function suggestedPrompt(state: OnboardingState): string {
  const completed = state.status === "completed" ? state : null;
  const role = ROLES.find((r) => r.id === completed?.role);
  const goal = GOALS.find((g) => g.id === completed?.goals[0]) ?? GOALS[0];
  return `Create a ${goal.phrase} for ${role?.audience ?? "my project"}.`;
}

// ---- storage -------------------------------------------------------------------------------------------------------

export type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * The external store behind `useOnboarding`. Storage can be missing (server render) or blocked (private mode,
 * disabled cookies): then the state lives in memory for the tab and nothing throws.
 */
export function createOnboardingStore(
  getStorage: () => StorageLike | null,
  options: { addStorageListener?: (listener: (event: { key: string | null }) => void) => () => void } = {},
) {
  let memory: string | null = null;
  let cachedRaw: string | null | undefined;
  let cached: OnboardingState = UNSEEN;
  const listeners = new Set<() => void>();
  let detach: (() => void) | null = null;

  const storage = (): StorageLike | null => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };
  const readRaw = (): string | null => {
    try {
      const value = storage()?.getItem(ONBOARDING_STORAGE_KEY) ?? null;
      return value ?? memory;
    } catch {
      return memory;
    }
  };
  const notify = () => listeners.forEach((listener) => listener());

  return {
    /** The same object until the stored data changes. */
    get(): OnboardingState {
      const raw = readRaw();
      if (raw !== cachedRaw) {
        cachedRaw = raw;
        cached = parseOnboarding(raw);
      }
      return cached;
    },
    set(state: SavedOnboarding) {
      const raw = serializeOnboarding(state);
      try {
        const s = storage();
        if (!s) throw new Error("no storage");
        s.setItem(ONBOARDING_STORAGE_KEY, raw);
        memory = null;
      } catch {
        memory = raw;
      }
      notify();
    },
    reset() {
      memory = null;
      try {
        storage()?.removeItem(ONBOARDING_STORAGE_KEY);
      } catch {
        // blocked storage: nothing was saved there anyway
      }
      notify();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (listeners.size === 1 && options.addStorageListener) {
        // Another tab finished (or reset) the intro: follow it.
        detach = options.addStorageListener((event) => {
          if (event.key === null || event.key === ONBOARDING_STORAGE_KEY) notify();
        });
      }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          detach?.();
          detach = null;
        }
      };
    },
  };
}
