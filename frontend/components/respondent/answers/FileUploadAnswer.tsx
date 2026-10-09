"use client";

import { clsx } from "clsx";
import { FileText, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import {
  MAX_FILE_BYTES,
  TOO_BIG_ERROR,
  formatFileSize,
  previewFile,
  uploadResponseFile,
} from "@/lib/fileUpload";
import type { UploadedFile } from "@/lib/types";
import { useFormSlug } from "../FormSlugContext";
import type { AnswerProps } from "../types";

/**
 * Typeform's file upload: a dashed drop zone ("Choose file or drag here", 10MB limit), a progress bar while the file
 * goes up, then the file with a remove button. Not autofocused, so Enter still moves on like every other question.
 */
export function FileUploadAnswer({ value, onChange, labelledBy }: AnswerProps<"file_upload">) {
  const slug = useFormSlug();
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const limitId = useId();

  // Leaving the question mid-upload cancels it.
  useEffect(() => () => abortRef.current?.abort(), []);

  async function take(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_FILE_BYTES) return setError(TOO_BIG_ERROR);
    // Previews (builder, full preview) have no published form to upload to: keep the file in the browser.
    if (!slug) return onChange(previewFile(file));

    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);
    try {
      onChange(await uploadResponseFile(slug, file, setProgress, controller.signal));
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        setError(e instanceof Error ? e.message : "The upload didn't go through. Please try again.");
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  function remove(file: UploadedFile) {
    if (file.url.startsWith("blob:")) URL.revokeObjectURL(file.url);
    onChange(undefined);
    setError(null);
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    void take(e.dataTransfer.files[0]);
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      className="sr-only"
      tabIndex={-1}
      aria-labelledby={labelledBy}
      aria-describedby={limitId}
      onChange={(e) => {
        void take(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (value) {
    const isImage = value.type?.startsWith("image/");
    return (
      <div className="flex w-full max-w-xl items-center gap-4 rounded-resp-button border border-resp-accent/40 bg-resp-accent/5 p-3 text-resp-accent">
        {isImage ? (
          // eslint-disable-next-line @next/next/no-img-element -- the respondent's own upload
          <img src={value.url} alt="" className="size-14 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded bg-resp-accent/10">
            <FileText className="size-6" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-medium sm:text-lg">{value.name}</p>
          <p className="text-sm opacity-70">{formatFileSize(value.size)}</p>
        </div>
        <button
          type="button"
          aria-label={`Remove ${value.name}`}
          title="Remove file"
          onClick={() => remove(value)}
          // Enter on this button removes the file; it must not also move to the next question.
          onKeyDown={(e) => e.key === "Enter" && e.stopPropagation()}
          className="flex size-9 shrink-0 items-center justify-center rounded-full hover:bg-resp-accent/10 focus-visible:outline-2 focus-visible:outline-resp-accent"
        >
          <X className="size-5" aria-hidden />
        </button>
        {input}
      </div>
    );
  }

  const uploading = progress !== null;
  return (
    <div className="w-full max-w-xl">
      <button
        type="button"
        disabled={uploading}
        aria-labelledby={labelledBy}
        aria-describedby={limitId}
        onClick={() => inputRef.current?.click()}
        // Enter/Space choose a file here instead of moving on.
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && e.stopPropagation()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={clsx(
          "flex w-full flex-col items-center justify-center gap-2 rounded-resp-button border-2 border-dashed px-6 py-10 text-resp-accent transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-resp-accent disabled:cursor-wait",
          dragging ? "border-resp-accent bg-resp-accent/15" : "border-resp-accent/40 bg-resp-accent/5 hover:bg-resp-accent/10",
        )}
      >
        <Upload className="size-8" aria-hidden />
        {uploading ? (
          <span className="text-base sm:text-lg">Uploading… {Math.round(progress * 100)}%</span>
        ) : (
          <span className="text-base sm:text-lg">
            <strong className="font-semibold">Choose file</strong> or drag here
          </span>
        )}
        <span id={limitId} className="text-sm opacity-70">
          Size limit: 10MB
        </span>
        {uploading && (
          <span
            role="progressbar"
            aria-label="Upload progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            className="mt-2 h-1 w-full max-w-xs overflow-hidden rounded-full bg-resp-accent/20"
          >
            <span className="block h-full bg-resp-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
          </span>
        )}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-resp-error">
          {error}
        </p>
      )}
      {input}
    </div>
  );
}
