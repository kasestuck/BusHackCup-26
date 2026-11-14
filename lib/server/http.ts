import "server-only";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { ZodType } from "zod";
import {
  ApiErrorResponseSchema,
  ErrorMessageExamples,
  type ApiError,
  type ApiErrorResponse,
} from "./contract.ts";
import { createBearerClient, createSessionClient, MissingSessionError, ServerConfigurationError } from "./supabase.ts";

type ErrorCode = ApiError["error"]["code"];

export class HttpError extends Error {
  readonly response: ApiErrorResponse;

  constructor(status: ApiErrorResponse["status"], code: ErrorCode, message?: string) {
    if (message !== undefined && (code !== "not_enough_coins" || !/^You need [1-9][0-9]* more coins\.$/.test(message))) {
      throw new Error("Only a validated coin shortfall message may override an API error message.");
    }
    const response = ApiErrorResponseSchema.parse({
      status,
      body: { error: { code, message: message ?? ErrorMessageExamples[code] } },
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
  createBearerClient?: (token: string) => SupabaseClient | Promise<SupabaseClient>;
};

function responseHeaders(initial?: HeadersInit): Headers {
  const headers = new Headers(initial);
  headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  headers.set("Expires", "0");
  headers.set("Pragma", "no-cache");
  for (const name of ["Cookie", "Authorization"]) {
    const vary = headers.get("Vary");
    if (!vary?.split(",").some((value) => value.trim().toLowerCase() === name.toLowerCase())) {
      headers.set("Vary", vary ? `${vary}, ${name}` : name);
    }
  }
  return headers;
}

function logUnexpectedError(error: unknown): void {
  if (error instanceof ServerConfigurationError) {
    // This message contains validated environment variable names, never their values.
    console.error("SERVER CONFIGURATION ERROR:", error.message);
    return;
  }
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
  } else if (error instanceof MissingSessionError) {
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

async function authenticate(request: Request, dependencies: AuthDependencies): Promise<AuthenticatedContext> {
  // Cookie identity takes precedence when both credentials are supplied.
  try {
    const supabase = await (dependencies.createClient ?? createSessionClient)();
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) return { user: data.user, supabase };
  } catch (error) {
    if (error instanceof ServerConfigurationError) throw error;
    // Malformed cookie decoding, expired sessions and failed verification fail closed.
  }

  const authorization = request.headers.get("Authorization");
  const token = authorization?.match(/^Bearer[\t ]+([^\s,]+)$/i)?.[1];
  if (!token) throw new HttpError(401, "unauthorized");

  try {
    const supabase = await (dependencies.createBearerClient ?? createBearerClient)(token);
    const { data, error } = await supabase.auth.getUser(token);
    if (!error && data.user) return { user: data.user, supabase };
  } catch (error) {
    if (error instanceof ServerConfigurationError) throw error;
  }
  throw new HttpError(401, "unauthorized");
}

/** Authorization always comes from a verified Auth server response, never cookie contents. */
export function withAuth(handler: AuthenticatedHandler, dependencies: AuthDependencies = {}) {
  return async (request: Request): Promise<Response> => {
    try {
      const context = await authenticate(request, dependencies);
      const response = await handler(request, context);
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
