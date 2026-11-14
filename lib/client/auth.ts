"use client";

/**
 * Browser auth (SPEC §3 #1: email + password or magic link) via Supabase.
 * @supabase/ssr keeps the session in cookies, so the backend's route handlers
 * can read it on every /api/** request (SPEC §6: "Supabase session (cookie)").
 *
 * Modes:
 *  - "supabase": NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY are set.
 *  - "mock": NEXT_PUBLIC_USE_MOCKS=true — no network; moves the mock scenario instead.
 *  - "unconfigured": neither — every call fails loudly instead of pretending.
 */
import { createBrowserClient } from "@supabase/ssr";
import { authErrorMessage } from "./auth-utils";
import { USE_MOCKS, getMockScenario, setMockScenario } from "./mocks";
import { invalidateApi } from "./use-api";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const AUTH_MODE: "mock" | "supabase" | "unconfigured" = USE_MOCKS
  ? "mock"
  : SUPABASE_URL && SUPABASE_ANON_KEY
    ? "supabase"
    : "unconfigured";

export type AuthResult =
  | { ok: true; needsConfirmation?: boolean }
  | { ok: false; message: string };

const UNCONFIGURED: AuthResult = {
  ok: false,
  message: "Sign-in isn't configured yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
};

/** createBrowserClient is a singleton in the browser, so this is cheap to call. */
function supabase() {
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}

const mockDelay = () => new Promise((r) => setTimeout(r, 500));

function callbackUrl(next: string) {
  const u = new URL("/auth/callback", window.location.origin);
  u.searchParams.set("next", next);
  return u.toString();
}

function fail(e: unknown): AuthResult {
  const err = (e ?? {}) as { code?: string; status?: number; message?: string };
  return { ok: false, message: authErrorMessage(err) };
}

export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  if (AUTH_MODE === "unconfigured") return UNCONFIGURED;
  if (AUTH_MODE === "mock") {
    await mockDelay();
    if (getMockScenario() === "unauthorized") setMockScenario("default", { clearData: true });
    invalidateApi();
    return { ok: true };
  }
  try {
    const { error } = await supabase().auth.signInWithPassword({ email: email.trim(), password });
    if (error) return fail(error);
    invalidateApi();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** New accounts continue to onboarding. With email confirmation on, Supabase returns no session yet. */
export async function signUp(email: string, password: string): Promise<AuthResult> {
  if (AUTH_MODE === "unconfigured") return UNCONFIGURED;
  if (AUTH_MODE === "mock") {
    await mockDelay();
    setMockScenario("new_user", { clearData: true });
    invalidateApi();
    return { ok: true };
  }
  try {
    const { data, error } = await supabase().auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callbackUrl("/onboarding") },
    });
    if (error) return fail(error);
    invalidateApi();
    return { ok: true, needsConfirmation: !data.session };
  } catch (e) {
    return fail(e);
  }
}

export async function sendMagicLink(email: string, next: string): Promise<AuthResult> {
  if (AUTH_MODE === "unconfigured") return UNCONFIGURED;
  if (AUTH_MODE === "mock") {
    await mockDelay();
    return { ok: true, needsConfirmation: true };
  }
  try {
    const { error } = await supabase().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: callbackUrl(next), shouldCreateUser: true },
    });
    return error ? fail(error) : { ok: true, needsConfirmation: true };
  } catch (e) {
    return fail(e);
  }
}

/** Mock-only: the "email link" the mock would have sent. */
export function mockMagicLinkUrl(next: string) {
  const u = new URL(callbackUrl(next));
  u.searchParams.set("code", "mock");
  return `${u.pathname}${u.search}`;
}

/** Magic-link / confirmation landing: trade the one-time ?code= for a session cookie (PKCE). */
export async function exchangeCode(code: string): Promise<AuthResult> {
  if (AUTH_MODE === "unconfigured") return UNCONFIGURED;
  if (AUTH_MODE === "mock") {
    await mockDelay();
    if (code !== "mock") return { ok: false, message: authErrorMessage({ code: "otp_expired" }) };
    if (getMockScenario() === "unauthorized") setMockScenario("default", { clearData: true });
    invalidateApi();
    return { ok: true };
  }
  try {
    const { error } = await supabase().auth.exchangeCodeForSession(code);
    if (error) return fail(error);
    invalidateApi();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function signOut(): Promise<AuthResult> {
  if (AUTH_MODE === "unconfigured") return UNCONFIGURED;
  if (AUTH_MODE === "mock") {
    await mockDelay();
    setMockScenario("unauthorized", { clearData: true });
    invalidateApi();
    return { ok: true };
  }
  try {
    const { error } = await supabase().auth.signOut();
    if (error) return fail(error);
    invalidateApi();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
