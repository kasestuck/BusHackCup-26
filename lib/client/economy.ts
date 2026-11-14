/**
 * Display-only copy of the coin rules in SPEC §7 ("Earning coins").
 * The server is the source of truth (lib/server/economy.ts). If the backend changes
 * these numbers, update this file — or better, expose them via the API and delete it.
 */
export const EARN_RULES = [
  { key: "checkin", coins: 40, title: "Check in at the gym", detail: "Scan the QR at a partner gym. Once a day." },
  { key: "session", coins: 10, title: "Log your workout", detail: "Finish today's session in the log. Once a day." },
  { key: "week", coins: 50, title: "Complete your week", detail: "Hit every planned day this week for a bonus." },
] as const;

/** SPEC §7 "Free and Pro": price shown on screen. */
export const PRO_PRICE_USD = 12.99;
