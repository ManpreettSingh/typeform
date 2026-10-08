const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api").replace(/\/$/, "");

/** Normalised error for every failed request. `fieldErrors` is keyed by question id (422 validation). */
export class ApiError extends Error {
  readonly status: number;
  readonly fieldErrors: Record<string, string>;

  constructor(status: number, message: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fieldErrors = fieldErrors;
  }
}

type FastApiValidationItem = { loc?: (string | number)[]; msg?: string };

function toApiError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;

  if (typeof detail === "string") return new ApiError(status, detail);

  // Our own validation shape: { detail: { errors: { "<qid>": "msg" } } }
  if (detail && typeof detail === "object" && "errors" in detail) {
    const errors = (detail as { errors: Record<string, string> }).errors;
    return new ApiError(status, "Please fix the highlighted fields.", errors);
  }

  // FastAPI's default request-validation shape: { detail: [{ loc, msg }] }
  if (Array.isArray(detail)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of detail as FastApiValidationItem[]) {
      const key = item.loc?.slice(1).join(".") || "body";
      fieldErrors[key] = item.msg ?? "Invalid value";
    }
    return new ApiError(status, "Invalid request.", fieldErrors);
  }

  return new ApiError(status, `Request failed (${status})`);
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  let res: Response;

  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: {
        Accept: "application/json",
        ...(json !== undefined && { "Content-Type": "application/json" }),
        ...headers,
      },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  }

  if (res.status === 204) return undefined as T;

  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) throw toApiError(res.status, body);
  return body as T;
}

export const apiGet = <T>(path: string) => api<T>(path);
export const apiPost = <T>(path: string, json?: unknown) => api<T>(path, { method: "POST", json });
export const apiPatch = <T>(path: string, json: unknown) => api<T>(path, { method: "PATCH", json });
export const apiPut = <T>(path: string, json: unknown) => api<T>(path, { method: "PUT", json });
export const apiDelete = <T = void>(path: string) => api<T>(path, { method: "DELETE" });
