import "server-only";

import { createServerClient } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers.js";

export class MissingSessionError extends Error {
  constructor() {
    super("No session cookie was provided.");
    this.name = "MissingSessionError";
  }
}

export class ServerConfigurationError extends Error {
  constructor(variables: readonly string[], reason: "missing" | "invalid" = "missing") {
    const names = variables.filter((name) => /^[A-Z][A-Z0-9_]*$/.test(name));
    super(`${reason === "missing" ? "Missing" : "Invalid"} server configuration: ${names.join(" or ")}.`);
    this.name = "ServerConfigurationError";
  }
}

function requiredEnvironment(primary: string, fallback?: string): string {
  const value = process.env[primary]?.trim() || (fallback ? process.env[fallback]?.trim() : undefined);
  if (!value) throw new ServerConfigurationError(fallback ? [primary, fallback] : [primary]);
  return value;
}

function projectUrl(): string {
  const value = requiredEnvironment("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol)) throw new Error("Invalid protocol.");
  } catch {
    throw new ServerConfigurationError(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"], "invalid");
  }
  return value;
}

const noStoreFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: "no-store" });

/** Create one cookie-backed client per Route Handler request. */
export async function createSessionClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  const hasSessionCookie = cookieStore.getAll().some(({ name, value }) =>
    /^sb-.+-auth-token(?:\.\d+)?$/.test(name) && value.length > 0,
  );

  // Presence only avoids unnecessary configuration/network work. It never proves identity.
  if (!hasSessionCookie) throw new MissingSessionError();

  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");

  return createServerClient(projectUrl(), anonKey, {
    global: { fetch: noStoreFetch },
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        // Route Handlers can write cookies. A failed write must not be silently ignored.
        // withAuth applies the SSR library's required cache headers to every response.
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
}

/** Bind REST requests to the same bearer token that withAuth verifies with getUser(token). */
export function createBearerClient(token: string): SupabaseClient {
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY");
  return createClient(projectUrl(), anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: noStoreFetch,
      headers: { Authorization: `Bearer ${token}` },
    },
  });
}

/** Service credentials are read lazily and never mixed with a user's session. */
export function createAdminClient(): SupabaseClient {
  const serviceKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(projectUrl(), serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: noStoreFetch },
  });
}
