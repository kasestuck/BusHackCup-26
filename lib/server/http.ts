import "server-only";

import { isAuthError, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import {
  ApiErrorResponseSchema,
  ErrorMessageExamples,
  type ApiError,
  type ApiErrorResponse,
} from "./contract.ts";
import { createSessionClient, MissingSessionError } from "./supabase.ts";

type ErrorCode = ApiError["error"]["code"];

export class HttpError extends Error {
  readonly response: ApiErrorResponse;

  constructor(status: ApiErrorResponse["status"], code: ErrorCode) {
    const response = ApiErrorResponseSchema.parse({
      status,
      body: { error: { code, message: ErrorMessageExamples[code] } },
    });
    super(response.body.error.message);
    this.name = "HttpError";
    this.response = response;
  }
}

export type AuthenticatedContext = {
  user: User;
  supabase: SupabaseClient;
};

type AuthenticatedHandler = (
  request: Request,
  context: AuthenticatedContext,
) => Response | Promise<Response>;

type AuthDependencies = {
  createClient?: () => Promise<SupabaseClient>;
};

function responseHeaders(initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  headers.set("Expires", "0");
  headers.set("Pragma", "no-cache");
  const vary = headers.get("Vary");
  if (!vary?.split(",").some((value) => value.trim().toLowerCase() === "cookie")) {
    headers.set("Vary", vary ? `${vary}, Cookie` : "Cookie");
  }
  return headers;
}

function unauthorizedAuthError(error: unknown): boolean {
  return isAuthError(error)
    && typeof error.status === "number"
    && error.status >= 400
    && error.status < 500
    && error.status !== 429;
}

function logUnexpectedError(error: unknown): void {
  // Do not log arbitrary provider messages, SQL details, request data, tokens or headers.
  const fields = error && typeof error === "object" ? error as Record<string, unknown> : {};
  const name = error instanceof Error ? error.constructor.name : "UnknownError";
  const code = typeof fields.code === "string" && /^[A-Za-z0-9_]{1,64}$/.test(fields.code)
    ? fields.code : undefined;
  const status = typeof fields.status === "number" && Number.isInteger(fields.status)
    ? fields.status : undefined;
  console.error("Unexpected API error.", { name, code, status });
}

export function handleError(error: unknown): Response {
  let failure: HttpError;
  if (error instanceof HttpError) {
    failure = error;
  } else if (error instanceof MissingSessionError || unauthorizedAuthError(error)) {
    failure = new HttpError(401, "unauthorized");
  } else {
    logUnexpectedError(error);
    failure = new HttpError(500, "internal_error");
  }
  return Response.json(failure.response.body, {
    status: failure.response.status,
    headers: responseHeaders(),
  });
}

/** Authorization always comes from a verified Auth server response, never cookie contents. */
export function withAuth(handler: AuthenticatedHandler, dependencies: AuthDependencies = {}) {
  return async (request: Request): Promise<Response> => {
    try {
      const supabase = await (dependencies.createClient ?? createSessionClient)();
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      if (!data.user) throw new HttpError(401, "unauthorized");

      const response = await handler(request, { user: data.user, supabase });
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders(response.headers),
      });
    } catch (error) {
      return handleError(error);
    }
  };
}

function parseInput<T>(schema: ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new HttpError(422, "validation_error");
  return result.data;
}

export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  const mediaType = request.headers.get("Content-Type")?.split(";", 1)[0].trim().toLowerCase();
  if (mediaType !== "application/json") throw new HttpError(422, "validation_error");

  let value: unknown;
  try {
    value = await request.json();
  } catch {
    throw new HttpError(422, "validation_error");
  }
  return parseInput(schema, value);
}

export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const search = new URL(request.url).searchParams;
  if (search.size === 0) {
    const empty = schema.safeParse(undefined);
    if (empty.success) return empty.data;
  }

  const values: Record<string, string | string[]> = Object.create(null);
  for (const [key, value] of search) {
    const existing = values[key];
    // Preserve duplicates so a single-value schema rejects ambiguous query parameters.
    values[key] = existing === undefined ? value : Array.isArray(existing) ? [...existing, value] : [existing, value];
  }
  return parseInput(schema, values);
}

/** Invalid server output is an internal error, not a client validation error. */
export function jsonResponse<T>(schema: ZodType<T>, data: unknown, status = 200): Response {
  return Response.json(schema.parse(data), { status, headers: responseHeaders() });
}
