"use client";

import { clsx } from "clsx";
import { Circle, CloudUpload, Loader2, RotateCcw, Square, Video } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button, Modal } from "@/components/ui";
import type { QuestionVideo } from "@/lib/types";
import { MAX_VIDEO_BYTES, uploadMedia } from "@/lib/upload";

type Step = "choose" | "webcam" | "uploading";

/**
 * Typeform's "How would you like to create this question?": record with the webcam, or upload a video. The result
 * is uploaded to Cloudinary and handed back; the camera is always switched off when the dialog closes.
 */
type Props = { open: boolean; onClose: () => void; onDone: (video: QuestionVideo) => void };

export function VideoQuestionDialog({ open, onClose, onDone }: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Add video" size="xl">
      {/* Mounted only while open, so every opening starts at the choice and the camera is off once closed. */}
      {open && <DialogBody onClose={onClose} onDone={onDone} />}
    </Modal>
  );
}

function DialogBody({ onClose, onDone }: Omit<Props, "open">) {
  const [step, setStep] = useState<Step>("choose");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: Blob, name: string) {
    setError(null);
    if (file.size > MAX_VIDEO_BYTES) return setError("That video is too big. The limit is 100MB.");
    setStep("uploading");
    setProgress(0);
    try {
      const video = await uploadMedia(new File([file], name, { type: file.type || "video/webm" }), "video", setProgress);
      onDone(video);
      onClose();
    } catch {
      setError("The video didn't upload. Please try again.");
      setStep("choose");
    }
  }

  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center gap-6 py-6">
        {step === "choose" && (
          <>
            <h2 className="text-xl text-text sm:text-2xl">How would you like to create this question?</h2>
            <div className="flex flex-wrap justify-center gap-3">
              <ChoiceCard icon={<Video className="size-6" aria-hidden />} label="Webcam" onClick={() => setStep("webcam")} />
              <ChoiceCard
                icon={<CloudUpload className="size-6" aria-hidden />}
                label="Upload"
                hint="Up to 100MB"
                onClick={() => inputRef.current?.click()}
              />
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="video/mp4,video/webm,video/quicktime"
              className="hidden"
              aria-label="Video file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void upload(file, file.name);
              }}
            />
          </>
        )}

        {step === "webcam" && (
          <WebcamRecorder onCancel={() => setStep("choose")} onUse={(blob) => void upload(blob, "recording.webm")} />
        )}

        {step === "uploading" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-3 text-text-muted" role="status">
            <Loader2 className="size-6 animate-spin" aria-hidden />
            <p>Uploading video… {Math.round(progress * 100)}%</p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
              <div className="h-full bg-accent transition-[width]" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
    </div>
  );
}

function ChoiceCard({ icon, label, hint, onClick }: { icon: React.ReactNode; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[84px] w-[132px] flex-col items-center justify-center gap-1 rounded-card border border-border bg-bg text-sm text-text shadow-sm transition-colors hover:bg-bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
    >
      {icon}
      <span className="font-medium">{label}</span>
      {hint && <span className="text-xs text-text-muted">{hint}</span>}
    </button>
  );
}

/** Live camera preview → record → review (retake or use). */
function WebcamRecorder({ onCancel, onUse }: { onCancel: () => void; onUse: (blob: Blob) => void }) {
  const liveRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [state, setState] = useState<"starting" | "ready" | "recording" | "review" | "denied">(() =>
    typeof navigator !== "undefined" && navigator.mediaDevices ? "starting" : "denied",
  );
  const [recording, setRecording] = useState<{ blob: Blob; url: string } | null>(null);
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    if (!navigator.mediaDevices) return; // no camera API: already "denied"
    let cancelled = false;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((stream) => {
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (liveRef.current) liveRef.current.srcObject = stream;
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("denied");
      });
    return () => {
      cancelled = true;
      if (recorderRef.current?.state === "recording") recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    if (state !== "recording") return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [state]);

  useEffect(() => () => void (recording && URL.revokeObjectURL(recording.url)), [recording]);

  function start() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current);
    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "video/webm" });
      setRecording({ blob, url: URL.createObjectURL(blob) });
      setState("review");
    };
    recorderRef.current = recorder;
    recorder.start();
    setSeconds(0);
    setState("recording");
  }

  if (state === "denied") {
    return (
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-text">We couldn&rsquo;t use your camera.</p>
        <p className="text-sm text-text-muted">Allow camera and microphone access in your browser, or upload a video instead.</p>
        <Button variant="secondary" onClick={onCancel}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full max-w-xl flex-col items-center gap-4">
      <div className="relative aspect-video w-full overflow-hidden rounded-card bg-black">
        {state === "review" && recording ? (
          <video src={recording.url} controls className="size-full" aria-label="Your recording" />
        ) : (
          <video
            // Re-attach the camera each time the preview mounts (it's replaced by the recording while reviewing).
            ref={(el) => {
              liveRef.current = el;
              if (el && streamRef.current && el.srcObject !== streamRef.current) el.srcObject = streamRef.current;
            }}
            autoPlay
            muted
            playsInline
            className="size-full -scale-x-100 object-cover"
            aria-label="Camera preview"
          />
        )}
        {state === "recording" && (
          <span className="absolute top-3 left-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
            <span className="size-2 animate-pulse rounded-full bg-red-500" aria-hidden />
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      <div className="flex gap-2">
        {state === "review" ? (
          <>
            <Button variant="secondary" leftIcon={<RotateCcw className="size-4" aria-hidden />} onClick={() => setState("ready")}>
              Retake
            </Button>
            <Button onClick={() => recording && onUse(recording.blob)}>Use this video</Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={onCancel}>
              Back
            </Button>
            <Button
              disabled={state === "starting"}
              className={clsx(state === "recording" && "bg-danger hover:bg-danger")}
              leftIcon={
                state === "recording" ? <Square className="size-4" aria-hidden /> : <Circle className="size-4 fill-current" aria-hidden />
              }
              onClick={() => (state === "recording" ? recorderRef.current?.stop() : start())}
            >
              {state === "recording" ? "Stop" : "Record"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
