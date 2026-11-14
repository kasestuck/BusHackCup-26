/**
 * Auth helpers that don't touch the network. Pure — runs under `node --test`.
 */

/**
 * Only same-site relative paths are allowed as a post-login destination,
 * so a crafted `?next=https://evil.example` or `//evil.example` can't redirect users off-site.
 */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/^\/(login|signup|auth)(\/|$|\?)/.test(next)) return fallback;
  return next;
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

export const MIN_PASSWORD = 8;

export function passwordProblem(value: string): string | null {
  if (value.length < MIN_PASSWORD) return `Use at least ${MIN_PASSWORD} characters.`;
  return null;
}

/** Map Supabase auth errors (by code, then status) to friendly copy. */
export function authErrorMessage(e: { code?: string; status?: number; message?: string }): string {
  switch (e.code) {
    case "invalid_credentials":
      return "Email or password is incorrect.";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Log in instead.";
    case "email_not_confirmed":
      return "Confirm your email first. Check your inbox for the link.";
    case "weak_password":
      return "Choose a stronger password.";
    case "over_email_send_rate_limit":
    case "over_request_rate_limit":
      return "Too many attempts. Give it a minute and try again.";
    case "otp_expired":
      return "That link has expired. Request a new one.";
    case "signup_disabled":
      return "Sign-ups are closed right now.";
  }
  if (e.status === 429) return "Too many attempts. Give it a minute and try again.";
  if (e.status === 0 || e.message === "Failed to fetch") return "We couldn't reach ShowUp. Check your connection.";
  return "Something went wrong. Please try again.";
}
