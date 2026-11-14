import assert from "node:assert/strict";
import { test } from "node:test";
import { addCalendarDays, isoWeekday, localDateAt, weekStartDate } from "./time.ts";

test("Sunday has ISO weekday 7 and a Monday week start in two timezones", () => {
  const instant = new Date("2026-11-15T12:00:00.000Z");
  for (const timezone of ["America/New_York", "Asia/Yekaterinburg"]) {
    const localDate = localDateAt(instant, timezone);
    assert.equal(localDate, "2026-11-15");
    assert.equal(isoWeekday(localDate), 7);
    assert.equal(weekStartDate(localDate), "2026-11-09");
  }
});

test("one instant can fall in Sunday and Monday ISO weeks in different timezones", () => {
  const instant = new Date("2026-11-16T00:30:00.000Z");
  const losAngeles = localDateAt(instant, "America/Los_Angeles");
  const yekaterinburg = localDateAt(instant, "Asia/Yekaterinburg");
  assert.equal(losAngeles, "2026-11-15");
  assert.equal(weekStartDate(losAngeles), "2026-11-09");
  assert.equal(yekaterinburg, "2026-11-16");
  assert.equal(weekStartDate(yekaterinburg), "2026-11-16");
});

test("spring DST preserves the local day and moves midnight to the new UTC offset", () => {
  const timezone = "America/New_York";
  for (const timestamp of ["2026-03-08T06:59:00Z", "2026-03-08T07:01:00Z", "2026-03-09T03:59:00Z"]) {
    assert.equal(localDateAt(new Date(timestamp), timezone), "2026-03-08");
  }
  const monday = localDateAt(new Date("2026-03-09T04:00:00Z"), timezone);
  assert.equal(monday, "2026-03-09");
  assert.equal(weekStartDate(monday), monday);
  assert.equal(addCalendarDays("2026-03-08", 1), monday);
});

test("fall DST repeats an hour without creating a second local day", () => {
  const timezone = "America/New_York";
  for (const timestamp of ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2026-11-02T04:59:00Z"]) {
    const localDate = localDateAt(new Date(timestamp), timezone);
    assert.equal(localDate, "2026-11-01");
    assert.equal(weekStartDate(localDate), "2026-10-26");
  }
  assert.equal(localDateAt(new Date("2026-11-02T05:00:00Z"), timezone), "2026-11-02");
  assert.equal(addCalendarDays("2026-11-01", 1), "2026-11-02");
});

test("calendar arithmetic handles leap days and ISO weeks crossing a year", () => {
  assert.equal(addCalendarDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addCalendarDays("2024-03-01", -1), "2024-02-29");
  assert.equal(weekStartDate("2027-01-03"), "2026-12-28");
  assert.equal(isoWeekday("2027-01-04"), 1);
});

test("date helpers reject impossible dates, fractional offsets and invalid timezones", () => {
  assert.throws(() => isoWeekday("2026-02-30"), /Invalid local date/);
  assert.throws(() => isoWeekday("2026-2-03"), /Invalid local date/);
  assert.throws(() => addCalendarDays("2026-11-14", 0.5), /safe integer/);
  assert.throws(() => localDateAt(new Date(Number.NaN), "UTC"), /Invalid instant/);
  assert.throws(() => localDateAt(new Date("2026-11-14T00:00:00Z"), ""), /Invalid timezone/);
  assert.throws(() => localDateAt(new Date("2026-11-14T00:00:00Z"), "Invalid/Timezone"), /Invalid timezone/);
});
