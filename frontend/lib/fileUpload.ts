// File upload questions: the answer is where the file went ({url, name, size, type}). Mirrors
// backend/app/question_types/files.py; uploads go straight from the browser to Cloudinary with a signature from
// POST /public/forms/{slug}/uploads, so the file never passes through our API.
import { apiPost } from "./api";
import type { UploadedFile } from "./types";

/** Typeform's size limit for uploads. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
const NAME_MAX = 255;
export const UPLOAD_ERROR = "Please upload a file";
export const TOO_BIG_ERROR = "That file is too big. The size limit is 10MB";

/** Error for a stored answer, or null. Live answers are http(s); previews keep the file in the browser (blob:). */
export function validateUploadedFile(value: unknown): string | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return UPLOAD_ERROR;
  const { url, name, size } = value as Partial<UploadedFile>;
  if (typeof url !== "string" || !/^(https?:|blob:)/.test(url)) return UPLOAD_ERROR;
  if (typeof name !== "string" || !name.trim() || name.length > NAME_MAX) return UPLOAD_ERROR;
  if (typeof size !== "number" || !Number.isFinite(size) || size < 0) return UPLOAD_ERROR;
  return size > MAX_FILE_BYTES ? TOO_BIG_ERROR : null;
}

/** "900 B", "117 KB", "2.3 MB". */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type UploadSignature = {
  upload_url: string;
  api_key: string;
  timestamp: number;
  signature: string;
  folder: string;
  max_bytes: number;
};

/** Uploads a respondent's file for the published form `slug`; `onProgress` gets 0–1. */
export async function uploadResponseFile(
  slug: string,
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  if (file.size > MAX_FILE_BYTES) throw new Error(TOO_BIG_ERROR);
  const sig = await apiPost<UploadSignature>(`/public/forms/${encodeURIComponent(slug)}/uploads`);

  const body = new FormData();
  body.append("file", file);
  body.append("api_key", sig.api_key);
  body.append("timestamp", String(sig.timestamp));
  body.append("signature", sig.signature);
  body.append("folder", sig.folder);

  // XHR rather than fetch: fetch can't report upload progress.
  const result = await new Promise<{ secure_url: string; bytes?: number }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.upload_url);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300 && xhr.response?.secure_url
        ? resolve(xhr.response)
        : reject(new Error("The upload didn't go through. Please try again."));
    xhr.onerror = () => reject(new Error("The upload didn't go through. Check your connection and try again."));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(body);
  });

  return { url: result.secure_url, name: file.name, size: file.size, ...(file.type ? { type: file.type } : {}) };
}

/** Where a preview keeps a chosen file: in the browser only, nothing is uploaded or stored. */
export function previewFile(file: File): UploadedFile {
  return { url: URL.createObjectURL(file), name: file.name, size: file.size, ...(file.type ? { type: file.type } : {}) };
}

/** For links in results: the API's own files only ever have http(s) URLs. */
export const isWebUrl = (url: string) => /^https?:\/\//.test(url);
