/**
 * SPEC §7 "Free and Pro" + §9 limits — what Pro adds over Free.
 * The §7 table says "unlimited" plan generations while §9 caps Pro at 10/day;
 * copy uses the stricter §9 number until the team settles it.
 */
export const PRO_FEATURES = [
  { title: "More AI plan generations", detail: "Up to 10 a day instead of 1 a week." },
  { title: "Nutrition analysis from a photo", detail: "Snap a meal, get an approximate macro estimate." },
  { title: "Extended statistics", detail: "Deeper progress tracking." },
] as const;

/** Rows of the Free vs Pro comparison (SPEC §7). `true` = included. */
export const PLAN_COMPARISON: { feature: string; free: string | boolean; pro: string | boolean }[] = [
  { feature: "AI workout plan with technique videos", free: "1 / week", pro: "Up to 10 / day" },
  { feature: "Workout log, coins and gym check-ins", free: true, pro: true },
  { feature: "Nutrition analysis from a photo", free: false, pro: true },
  { feature: "Extended statistics", free: false, pro: true },
];
