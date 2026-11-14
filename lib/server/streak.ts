import { addCalendarDays, isoWeekday } from "./time.ts";

export type StreakInput = {
  weekdays: readonly number[];
  checkinDates: readonly string[];
  today: string;
};

function previousScheduledDate(localDate: string, weekdays: ReadonlySet<number>): string {
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = addCalendarDays(localDate, -offset);
    if (weekdays.has(isoWeekday(candidate))) return candidate;
  }
  throw new Error("At least one scheduled weekday is required.");
}

/**
 * Count consecutive scheduled days with a gym check-in. Both today and each
 * checkinDate must be derived in the profile timezone. Convert checked_in_at
 * with localDateAt; do not use the gym's stored local_date across timezones.
 * An unchecked scheduled today remains eligible until its local day has ended.
 * Unscheduled dates, future dates and duplicate check-ins do not add to a streak.
 */
export function calculateStreak({ weekdays, checkinDates, today }: StreakInput): number {
  const todayWeekday = isoWeekday(today);
  const scheduled = new Set<number>();
  for (const weekday of weekdays) {
    if (!Number.isInteger(weekday) || weekday < 1 || weekday > 7) {
      throw new RangeError("Scheduled weekdays must be integers from 1 through 7.");
    }
    scheduled.add(weekday);
  }
  if (scheduled.size === 0) return 0;

  const checked = new Set<string>();
  let earliestCheckin: string | undefined;
  for (const localDate of checkinDates) {
    const weekday = isoWeekday(localDate);
    if (localDate <= today && scheduled.has(weekday)) {
      checked.add(localDate);
      if (earliestCheckin === undefined || localDate < earliestCheckin) earliestCheckin = localDate;
    }
  }
  if (checked.size === 0) return 0;

  // Skip today when it is unscheduled or its check-in is still pending.
  let cursor = scheduled.has(todayWeekday) && checked.has(today)
    ? today
    : previousScheduledDate(today, scheduled);
  let streak = 0;
  while (checked.has(cursor)) {
    streak += 1;
    if (cursor === earliestCheckin) break;
    cursor = previousScheduledDate(cursor, scheduled);
  }
  return streak;
}
