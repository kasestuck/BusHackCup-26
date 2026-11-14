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

class SupabaseConfigurationError extends Error {
  constructor() {
    super("Supabase is not configured.");
    this.name = "SupabaseConfigurationError";
  }
}

function projectUrl(): string {
  const value = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value?.trim()) throw new SupabaseConfigurationError();
  return value.trim();
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

  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey?.trim()) throw new SupabaseConfigurationError();

  return createServerClient(projectUrl(), anonKey.trim(), {
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

/** Service credentials are read lazily and never mixed with a user's session. */
export function createAdminClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey?.trim()) throw new SupabaseConfigurationError();

  return createClient(projectUrl(), serviceKey.trim(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: noStoreFetch },
  });
}
