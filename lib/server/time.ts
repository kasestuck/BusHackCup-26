export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function parseLocalDate(localDate: string): Date {
  if (typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new RangeError("Invalid local date.");
  }
  const date = new Date(`${localDate}T00:00:00.000Z`);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1
      || date.toISOString().slice(0, 10) !== localDate) {
    throw new RangeError("Invalid local date.");
  }
  return date;
}

/** Return the Gregorian YYYY-MM-DD date of an instant in the supplied timezone. */
export function localDateAt(instant: Date, timezone: string): string {
  if (!(instant instanceof Date) || !Number.isFinite(instant.getTime())) {
    throw new RangeError("Invalid instant.");
  }
  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw new RangeError("Invalid timezone.");
  }
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      calendar: "gregory",
      numberingSystem: "latn",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      era: "short",
    }).formatToParts(instant);
  } catch {
    throw new RangeError("Invalid timezone.");
  }
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? "";
  if (value("era") !== "AD") throw new RangeError("Calendar date is out of range.");
  const localDate = `${value("year").padStart(4, "0")}-${value("month")}-${value("day")}`;
  parseLocalDate(localDate);
  return localDate;
}

/** ISO weekdays run from Monday (1) through Sunday (7). */
export function isoWeekday(localDate: string): IsoWeekday {
  const weekday = parseLocalDate(localDate).getUTCDay();
  return (weekday === 0 ? 7 : weekday) as IsoWeekday;
}

/** Calendar arithmetic uses date-only values, never fixed-duration timezone days. */
export function addCalendarDays(localDate: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw new RangeError("The day offset must be a safe integer.");
  const date = parseLocalDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1 || date.getUTCFullYear() > 9999) {
    throw new RangeError("Calendar date is out of range.");
  }
  return date.toISOString().slice(0, 10);
}

/** Return the Monday local date for the ISO week containing a local date. */
export function weekStartDate(localDate: string): string {
  return addCalendarDays(localDate, 1 - isoWeekday(localDate));
}
