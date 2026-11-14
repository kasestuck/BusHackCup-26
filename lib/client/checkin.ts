/**
 * Gym check-in helpers (SPEC §6 POST /api/checkin, §7 anti-abuse). Pure — runs under `node --test`.
 *
 * The gym screen's QR encodes a link to our own /checkin page with the gym id and the
 * current rotating token, so any phone camera (iPhone included) opens check-in prefilled.
 */

export function checkinUrl(origin: string, gymId: string, token: string): string {
  const u = new URL("/checkin", origin);
  u.searchParams.set("gym", gymId);
  u.searchParams.set("token", token);
  return u.toString();
}

/** Strip spaces/dashes people add when typing a code from the screen. */
export function normalizeCode(input: string): string {
  return input.replace(/[\s-]+/g, "").trim();
}

/**
 * Accepts either a raw code or a pasted check-in link and returns what it contains.
 * Links from other origins/paths are treated as plain text, never followed.
 */
export function parseCheckinInput(input: string, origin: string): { gymId: string | null; token: string } {
  const text = input.trim();
  try {
    const u = new URL(text);
    if (u.origin === origin && u.pathname === "/checkin") {
      return { gymId: u.searchParams.get("gym"), token: normalizeCode(u.searchParams.get("token") ?? "") };
    }
  } catch {
    // not a URL — fall through to a plain code
  }
  return { gymId: null, token: normalizeCode(text) };
}

/** "6 days" / "1 day" */
export function streakLabel(n: number): string {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

/** Seconds → "0:42" for the QR countdown. */
export function formatCountdown(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
