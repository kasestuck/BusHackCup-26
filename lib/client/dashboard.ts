/**
 * Pure helpers that turn contract data into dashboard view models.
 * Type-only imports so `node --test` can run this file directly.
 */
import type { Plan, PlanDay, Reward, Weekday } from "@/lib/contract";

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/** ISO weekday: Monday = 1 … Sunday = 7 (see PROPOSAL note in lib/contract). */
export function isoWeekday(date: Date): Weekday {
  return (((date.getDay() + 6) % 7) + 1) as Weekday;
}

export type ScheduledDay = { day: PlanDay; dayIndex: number };

/** Today's planned session, if today is a training day. */
export function getTodaySession(plan: Plan, today: Date): ScheduledDay | null {
  const wd = isoWeekday(today);
  const dayIndex = plan.days.findIndex((d) => d.weekday === wd);
  return dayIndex === -1 ? null : { day: plan.days[dayIndex], dayIndex };
}

/** The next planned session after today (wraps into next week). */
export function getNextSession(
  plan: Plan,
  today: Date,
): (ScheduledDay & { daysAway: number }) | null {
  if (plan.days.length === 0) return null;
  const wd = isoWeekday(today);
  let best: (ScheduledDay & { daysAway: number }) | null = null;
  for (let dayIndex = 0; dayIndex < plan.days.length; dayIndex++) {
    const day = plan.days[dayIndex];
    const daysAway = (day.weekday - wd + 7) % 7 || 7;
    if (!best || daysAway < best.daysAway) best = { day, dayIndex, daysAway };
  }
  return best;
}

export type WeekCell = {
  weekday: Weekday;
  label: (typeof WEEKDAY_SHORT)[number];
  date: Date;
  isToday: boolean;
  isPast: boolean;
  session: ScheduledDay | null;
};

/** Monday-first week containing `today`, with planned sessions attached. */
export function getWeek(plan: Plan | null, today: Date): WeekCell[] {
  const wd = isoWeekday(today);
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (wd - 1));
  return WEEKDAY_SHORT.map((label, i) => {
    const weekday = (i + 1) as Weekday;
    const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i);
    const dayIndex = plan ? plan.days.findIndex((d) => d.weekday === weekday) : -1;
    return {
      weekday,
      label,
      date,
      isToday: weekday === wd,
      isPast: weekday < wd,
      session: plan && dayIndex !== -1 ? { day: plan.days[dayIndex], dayIndex } : null,
    };
  });
}

export type RewardProgress = {
  reward: Reward;
  remaining: number;
  /** 0–1 */
  progress: number;
  affordable: boolean;
};

/**
 * The reward to show as "next": the cheapest active reward the user can't afford yet;
 * if they can afford everything, the most valuable one they can redeem now.
 */
export function getNextReward(rewards: Reward[], balance: number): RewardProgress | null {
  const active = rewards.filter((r) => r.active).sort((a, b) => a.cost_coins - b.cost_coins);
  if (active.length === 0) return null;
  const target = active.find((r) => r.cost_coins > balance) ?? active[active.length - 1];
  const remaining = Math.max(0, target.cost_coins - balance);
  return {
    reward: target,
    remaining,
    progress: target.cost_coins > 0 ? Math.min(1, balance / target.cost_coins) : 1,
    affordable: remaining === 0,
  };
}

export function countAffordable(rewards: Reward[], balance: number): number {
  return rewards.filter((r) => r.active && r.cost_coins <= balance).length;
}

export function greeting(date: Date): string {
  const h = date.getHours();
  if (h < 5) return "Late night";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}
