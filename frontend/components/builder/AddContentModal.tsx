"use client";

import { clsx } from "clsx";
import {
  AlignLeft,
  Blocks,
  Calendar,
  CalendarClock,
  CircleSlash,
  ChevronDown,
  CreditCard,
  Equal,
  Gauge,
  Globe,
  Grid3X3,
  Hash,
  Image,
  Info,
  ListChecks,
  ListOrdered,
  Mail,
  MapPin,
  Phone,
  Quote,
  Scale,
  Search,
  SlidersHorizontal,
  SquareCheck,
  Star,
  Upload,
  UserRound,
  Video,
  X,
  type LucideIcon,
} from "lucide-react";
import { useLayoutEffect, useState } from "react";
import { AiPromptBox } from "@/components/ai/AiPromptBox";
import { Badge, Button, IconButton, Modal } from "@/components/ui";
import type { QuestionType } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";

type Tab = "elements" | "import" | "ai";

type Element = { label: string; icon: LucideIcon; type?: QuestionType };
type Group = { title: string; chip: string; items: Element[] };

// Typeform's "Add form elements" catalogue. Items without a `type` aren't built here and show "Soon".
// Chip classes are literal so Tailwind generates them (tokens in globals.css).
const GROUPS: Group[] = [
  {
    title: "Contact info",
    chip: "bg-qt-contact",
    items: [
      { label: "Contact Info", icon: UserRound, type: "contact_info" },
      { label: "Email", icon: Mail, type: "email" },
      { label: "Phone Number", icon: Phone, type: "phone_number" },
      { label: "Address", icon: MapPin, type: "address" },
      { label: "Website", icon: Globe, type: "website" },
    ],
  },
  {
    title: "Choice",
    chip: "bg-qt-choice",
    items: [
      { label: "Multiple Choice", icon: ListChecks, type: "multiple_choice" },
      { label: "Dropdown", icon: ChevronDown, type: "dropdown" },
      { label: "Picture Choice", icon: Image },
      { label: "Yes/No", icon: CircleSlash, type: "yes_no" },
      { label: "Legal", icon: Scale, type: "legal" },
      { label: "Checkbox", icon: SquareCheck, type: "checkbox" },
    ],
  },
  {
    title: "Rating & ranking",
    chip: "bg-qt-rating",
    items: [
      { label: "Net Promoter Score®", icon: Gauge, type: "nps" },
      { label: "Opinion Scale", icon: SlidersHorizontal, type: "opinion_scale" },
      { label: "Rating", icon: Star, type: "rating" },
      { label: "Ranking", icon: ListOrdered, type: "ranking" },
      { label: "Matrix", icon: Grid3X3, type: "matrix" },
    ],
  },
  {
    title: "Text & Video",
    chip: "bg-qt-text",
    items: [
      { label: "Long Text", icon: AlignLeft, type: "long_text" },
      { label: "Short Text", icon: Equal, type: "short_text" },
      { label: "Video and Audio", icon: Video },
    ],
  },
  {
    title: "Other",
    chip: "bg-qt-other",
    items: [
      { label: "Number", icon: Hash, type: "number" },
      { label: "Date", icon: Calendar, type: "date" },
      { label: "Payment", icon: CreditCard, type: "payment" },
      { label: "File Upload", icon: Upload, type: "file_upload" },
      { label: "Scheduler", icon: CalendarClock },
    ],
  },
  {
    title: "Form structure",
    chip: "bg-qt-screen",
    items: [
      { label: "Welcome Screen", icon: AlignLeft }, // Placeholder for now, handled differently?
      { label: "Partial Submit Point", icon: CircleSlash }, // Soon
      { label: "Statement", icon: Quote, type: "statement" },
      { label: "Question Group", icon: Grid3X3, type: "group" },
      { label: "End Screen", icon: AlignLeft },
      { label: "Redirect to URL", icon: Globe },
    ],
  },
];

const RECOMMENDED: { label: string; icon: LucideIcon; type: QuestionType; chip: string }[] = [
  { label: "Multiple Choice", icon: ListChecks, type: "multiple_choice", chip: "bg-qt-choice" },
  { label: "Short Text", icon: Equal, type: "short_text", chip: "bg-qt-text" },
  { label: "Email", icon: Mail, type: "email", chip: "bg-qt-contact" },
];

const IMPORT_TITLE_MAX = 1000;
const IMPORT_MAX = 50;

/** Typeform's "Add content" modal: the element catalogue and "Import questions". */
export function AddContentModal({
  open,
  onClose,
  onAskAi,
}: {
  open: boolean;
  onClose: () => void;
  /** "Create with AI": the prompt typed in the AI tab; the caller opens Typeform AI's review view. */
  onAskAi: (prompt: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("elements");
  // After adding, focus belongs to the new question's title on the canvas, not back on "Add content".
  const [added, setAdded] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setAdded(false);
  }
  const done = () => {
    setAdded(true);
    onClose();
  };

  // Next's <Activity> keeps the builder mounted while hidden; reopen on the first tab.
  useLayoutEffect(() => () => setTab("elements"), []);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add content"
      size="xl"
      restoreFocus={!added}
      bodyClassName="mx-4 mb-4 rounded-card bg-bg"
      header={
        <div className="flex items-center justify-between rounded-t-modal bg-bg-subtle px-8 pt-1">
          <div role="tablist" aria-label="Add content" className="flex gap-7">
            {(
              [
                ["elements", "Add form elements"],
                ["import", "Import questions"],
                ["ai", "Create with AI"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={tab === value}
                onClick={() => setTab(value)}
                className={clsx(
                  // Typeform marks the active tab with a bar on top.
                  "relative h-12 text-sm font-medium focus-visible:outline-2 focus-visible:outline-accent",
                  tab === value
                    ? "text-text before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:rounded-b-[3px] before:bg-text-soft"
                    : "text-text-muted hover:text-text",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <IconButton label="Close" icon={<X className="size-4" />} size="sm" onClick={onClose} />
        </div>
      }
    >
      {tab === "elements" ? (
        <ElementsTab onDone={done} />
      ) : tab === "import" ? (
        <ImportTab onDone={done} />
      ) : (
        <AiTab
          onSubmit={(prompt) => {
            onClose();
            onAskAi(prompt);
          }}
        />
      )}
    </Modal>
  );
}

/** Typeform's "Create with AI" tab: the prompt box under "What would you like to create?". */
function AiTab({ onSubmit }: { onSubmit: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center gap-6 px-8 py-14">
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-sm font-medium text-text-muted">Typeform AI</p>
        <h3 className="text-2xl/8 font-normal text-text">What would you like to create?</h3>
      </div>
      <AiPromptBox autoFocus onSubmit={onSubmit} />
      <p className="max-w-[460px] text-center text-xs text-text-muted">
        Typeform AI adds to or edits this form. You review every change before it&rsquo;s applied.
      </p>
    </div>
  );
}

function ElementsTab({ onDone }: { onDone: () => void }) {
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const needle = query.trim().toLowerCase();

  async function add(type: QuestionType) {
    if (adding) return;
    setAdding(true);
    try {
      await addQuestion(type);
      onDone();
    } catch {
      // The store already showed a toast; keep the modal open.
    } finally {
      setAdding(false);
    }
  }

  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.label.toLowerCase().includes(needle)) })).filter(
    (g) => g.items.length > 0,
  );

  return (
    <div className="flex max-h-[70vh] flex-col gap-8 overflow-y-auto p-8 md:flex-row">
      <div className="flex shrink-0 flex-col gap-6 md:w-52">
        <label className="flex h-9 items-center gap-2 rounded-field border border-border-strong bg-field px-3 text-sm text-text-muted focus-within:border-text-muted">
          <Search className="size-4 shrink-0" aria-hidden />
          <input
            type="search"
            aria-label="Search form elements"
            placeholder="Search form elements"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent text-text placeholder:text-text-muted focus:outline-none"
          />
        </label>
        {!needle && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-medium text-text">Recommended</h3>
            {RECOMMENDED.map(({ label, icon: Icon, type, chip }) => (
              <button
                key={type}
                type="button"
                disabled={adding}
                onClick={() => void add(type)}
                className="flex h-10 items-center gap-2.5 rounded-field border border-border-strong bg-bg px-2.5 text-sm text-text-soft hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent disabled:opacity-60"
              >
                <span className={clsx("flex size-6 items-center justify-center rounded-input text-qt-fg", chip)}>
                  <Icon className="size-3.5" aria-hidden />
                </span>
                {label}
              </button>
            ))}
            
            <h3 className="mt-4 text-sm font-medium text-text">Connect to apps</h3>
            <button
              type="button"
              className="flex h-10 items-center gap-2.5 rounded-field border border-border-strong bg-bg px-2.5 text-sm text-text-soft hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-accent"
            >
              <span className="flex size-6 items-center justify-center rounded-input text-qt-fg bg-gray-200">
                <Blocks className="size-3.5" aria-hidden />
              </span>
              HubSpot
            </button>
            <button
              type="button"
              disabled
              className="flex h-10 items-center justify-between gap-2.5 rounded-field border border-border-strong bg-bg px-2.5 text-sm text-text-soft disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-input text-qt-fg bg-gray-200">
                  <Blocks className="size-3.5" aria-hidden />
                </span>
                Salesforce
              </div>
              <Badge variant="accent">Soon</Badge>
            </button>
            <button
              type="button"
              disabled
              className="flex h-10 items-center justify-between gap-2.5 rounded-field border border-border-strong bg-bg px-2.5 text-sm text-text-soft disabled:opacity-60"
            >
              <div className="flex items-center gap-2.5">
                <span className="flex size-6 items-center justify-center rounded-input text-qt-fg bg-gray-200">
                  <Grid3X3 className="size-3.5" aria-hidden />
                </span>
                Browse all apps
              </div>
              <Badge variant="accent">Soon</Badge>
            </button>
          </div>
        )}
      </div>

      <div className="grid flex-1 grid-cols-1 gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
        {groups.length === 0 && <p className="text-sm text-text-muted">No form elements match “{query.trim()}”.</p>}
        {groups.map((group) => (
          <section key={group.title} aria-label={group.title} className="flex flex-col gap-1">
            <h3 className="mb-2 text-sm font-medium text-text">{group.title}</h3>
            {group.items.map(({ label, icon: Icon, type }) => (
              <button
                key={label}
                type="button"
                disabled={!type || adding}
                title={type ? undefined : "Coming soon"}
                onClick={() => type && void add(type)}
                className={clsx(
                  "flex h-9 items-center gap-3 rounded-field px-1.5 text-left text-sm focus-visible:outline-2 focus-visible:outline-accent",
                  type ? "text-text-soft hover:bg-bg-hover" : "cursor-default text-text-muted",
                )}
              >
                <span
                  className={clsx(
                    "flex size-6 shrink-0 items-center justify-center rounded-input text-qt-fg",
                    group.chip,
                    !type && "opacity-50",
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                </span>
                <span className="flex-1">{label}</span>
                {!type && <Badge variant="accent">Soon</Badge>}
              </button>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}

/** Typeform's "Import questions": one question per line, each added as Short Text. */
function ImportTab({ onDone }: { onDone: () => void }) {
  const addQuestion = useBuilderStore((s) => s.addQuestion);
  const [text, setText] = useState("");
  const [importing, setImporting] = useState(false);
  const lines = text
    .split("\n")
    .map((l) => l.trim().slice(0, IMPORT_TITLE_MAX))
    .filter(Boolean)
    .slice(0, IMPORT_MAX);

  async function run() {
    setImporting(true);
    try {
      // One by one, so they land in order after the selected question.
      for (const title of lines) await addQuestion("short_text", { title });
      onDone();
    } catch {
      // The store already showed a toast for the failed one.
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-6 p-8 md:flex-row">
        <label className="flex flex-1 flex-col gap-2 text-sm text-text-muted">
          Form questions
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={12}
            placeholder="Copy and paste or type in your questions, and press enter after each one."
            className="w-full resize-none rounded-card border border-border-strong bg-canvas p-3 text-sm text-text placeholder:text-text-muted focus:border-text-muted focus:outline-none"
          />
        </label>
        <aside className="flex flex-col gap-2 self-start rounded-card border border-badge-line bg-badge-bg p-4 text-sm text-text-soft md:w-60">
          <Info className="size-5 text-info" aria-hidden />
          <p>Paste or type your questions, one per line. Each becomes a Short Text question you can change afterwards.</p>
          <p className="text-xs text-text-muted">Up to {IMPORT_MAX} at a time.</p>
        </aside>
      </div>
      <div className="flex justify-end rounded-b-card border-t border-border bg-bg-subtle px-8 py-3">
        <Button size="sm" loading={importing} disabled={lines.length === 0} onClick={() => void run()}>
          Import {lines.length > 0 ? lines.length : ""} {lines.length === 1 ? "question" : "questions"}
        </Button>
      </div>
    </div>
  );
}
