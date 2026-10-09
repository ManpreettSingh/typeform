import { X, ImageIcon } from "lucide-react";
import { newOptionId, optionLetter } from "@/lib/questionTypes";
import type { ChoiceOption, QuestionOf } from "@/lib/types";
import { useBuilderStore } from "@/store/builderStore";
import { uploadImage } from "@/lib/upload";
import { clsx } from "clsx";

const MIN_OPTIONS = 1;
const MAX_OPTIONS = 50;
const LABEL_MAX = 500;

export function CanvasPictureChoices({ question }: { question: QuestionOf<"picture_choice"> }) {
  const updateQuestion = useBuilderStore((s) => s.updateQuestion);
  const { options, allow_multiple, show_labels, supersized } = question.properties;
  
  function setOptions(next: ChoiceOption[], debounceMs?: number) {
    updateQuestion(question.id, { properties: { ...question.properties, options: next } }, debounceMs);
  }

  function addChoice() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions([...options, { id: newOptionId(), label: `Option ${options.length + 1}` }], 0);
  }

  function remove(index: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions(options.filter((_, i) => i !== index), 0);
  }

  function updateLabel(index: number, label: string) {
    const next = [...options];
    next[index] = { ...next[index], label };
    setOptions(next, 500);
  }

  async function handleImageUpload(index: number, file: File) {
    try {
      const { url, public_id } = await uploadImage(file);
      const next = [...options];
      next[index] = {
        ...next[index],
        attachment: {
          type: "image",
          public_id: public_id,
          url: url,
          alt: file.name,
        }
      };
      setOptions(next, 0);
    } catch (err) {
      console.error(err);
      // alert removed since fallback handles it
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {allow_multiple && <p className="text-sm opacity-70">Choose as many as you like</p>}
      
      <div className={clsx("grid gap-4", supersized ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4")}>
        {options.map((opt, i) => (
          <div key={opt.id} className="group relative flex flex-col items-center gap-2 rounded-xl border-2 border-transparent bg-resp-bg p-2 transition-colors hover:border-resp-accent/20">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-resp-accent/5 ring-1 ring-border shadow-sm flex items-center justify-center">
              {opt.attachment?.url ? (
                <img src={opt.attachment.url} alt={opt.label} className="h-full w-full object-cover" />
              ) : (
                <label className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-resp-accent/50 hover:bg-resp-accent/10 transition-colors">
                  <ImageIcon className="size-6" />
                  <span className="text-xs font-medium">Add image</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImageUpload(i, file);
                    }} 
                  />
                </label>
              )}
              
              {options.length > MIN_OPTIONS && (
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="absolute right-1 top-1 rounded-full bg-resp-bg/80 p-1 text-resp-text opacity-0 backdrop-blur hover:bg-resp-error hover:text-white group-hover:opacity-100 transition-opacity"
                  aria-label="Remove choice"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            
            {show_labels && (
              <div className="flex w-full items-center gap-2 px-1">
                <span className="flex size-5 shrink-0 items-center justify-center rounded-sm border border-resp-accent/50 text-[10px] font-bold text-resp-accent uppercase">
                  {optionLetter(i)}
                </span>
                <input
                  type="text"
                  value={opt.label}
                  onChange={(e) => updateLabel(i, e.target.value)}
                  maxLength={LABEL_MAX}
                  placeholder={`Option ${i + 1}`}
                  className="min-w-0 flex-1 bg-transparent text-sm font-medium leading-tight outline-none placeholder:opacity-50"
                />
              </div>
            )}
          </div>
        ))}
      </div>
      
      {options.length < MAX_OPTIONS && (
        <button
          type="button"
          onClick={addChoice}
          className="self-start text-sm font-semibold text-resp-accent opacity-70 hover:opacity-100 mt-2"
        >
          + Add choice
        </button>
      )}
    </div>
  );
}

