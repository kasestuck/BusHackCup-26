import type { z } from "zod";
import { ApiErrorBodySchema } from "@/lib/contract";
import { USE_MOCKS, mockFetch } from "./mocks";

/** Normalised client-side error. `status` 0 = network failure, never reached the server. */
export type ApiError = {
  status: number;
  code: string;
  message: string;
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };

const NETWORK_ERROR: ApiError = {
  status: 0,
  code: "network_error",
  message: "We couldn't reach ShowUp. Check your connection and try again.",
};

function fallbackMessage(status: number): string {
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 404) return "Not found.";
  if (status === 429) return "Too many requests. Give it a minute and try again.";
  if (status >= 500) return "Something went wrong on our side. Please try again.";
  return "Request failed.";
}

/**
 * The only way the frontend talks to the backend: documented `/api/**` routes,
 * responses validated against `lib/contract`. With NEXT_PUBLIC_USE_MOCKS=true the
 * request is answered by `lib/client/mocks` with the same shapes.
 */
export async function apiRequest<S extends z.ZodType>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<ApiResult<z.infer<S>>> {
  let res: Response;
  try {
    res = USE_MOCKS
      ? await mockFetch(path, init)
      : await fetch(path, {
          ...init,
          credentials: "same-origin",
          headers: { Accept: "application/json", ...init?.headers },
        });
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok) {
    const parsed = ApiErrorBodySchema.safeParse(body);
    return {
      ok: false,
      error: parsed.success
        ? { status: res.status, ...parsed.data.error }
        : { status: res.status, code: `http_${res.status}`, message: fallbackMessage(res.status) },
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    if (process.env.NODE_ENV !== "production") {
      console.error(`[api] ${path} response does not match lib/contract`, parsed.error);
    }
    return {
      ok: false,
      error: {
        status: res.status,
        code: "invalid_response",
        message: "We received data we didn't expect. Please try again.",
      },
    };
  }
  return { ok: true, data: parsed.data };
}
