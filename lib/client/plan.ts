/**
 * Pure helpers for the My Plan screen. Type-only imports so `node --test` can run it.
 */
import type { Plan } from "@/lib/contract";
import { getNextSession, getTodaySession } from "./dashboard.ts";

/**
 * Which plan day to show: a valid `?day=` index wins, then today's session,
 * then the next upcoming one, then the first day.
 */
export function resolveDayIndex(plan: Plan, today: Date, param: string | null): number {
  if (plan.days.length === 0) return -1;
  if (param !== null && /^\d+$/.test(param)) {
    const i = Number(param);
    if (i < plan.days.length) return i;
  }
  return getTodaySession(plan, today)?.dayIndex ?? getNextSession(plan, today)?.dayIndex ?? 0;
}

export type WeekTotals = { sessions: number; minutes: number; exercises: number; sets: number };

export function weekTotals(plan: Plan): WeekTotals {
  return plan.days.reduce(
    (t, d) => ({
      sessions: t.sessions + 1,
      minutes: t.minutes + d.duration_min,
      exercises: t.exercises + d.exercises.length,
      sets: t.sets + d.exercises.reduce((n, e) => n + e.sets, 0),
    }),
    { sessions: 0, minutes: 0, exercises: 0, sets: 0 },
  );
}

/** 90 → "1:30", 45 → "0:45" */
export function formatRest(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** SPEC §8: privacy-enhanced embed, no autoplay. */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1`;
}

export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;
}

/** Mock plans carry placeholder IDs; real ones come from the verified catalog seed. */
export function isPlaceholderVideo(id: string): boolean {
  return id.startsWith("mock-");
}
