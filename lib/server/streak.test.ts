import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateStreak } from "./streak.ts";
import { localDateAt } from "./time.ts";

const weekdays = [1, 3, 5];

test("an empty schedule or no check-ins has a zero streak", () => {
  assert.equal(calculateStreak({ weekdays: [], checkinDates: ["2026-11-16"], today: "2026-11-18" }), 0);
  assert.equal(calculateStreak({ weekdays, checkinDates: [], today: "2026-11-18" }), 0);
});

test("consecutive scheduled days count across unscheduled days and the weekend", () => {
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-13", "2026-11-16", "2026-11-18"], today: "2026-11-19",
  }), 3);
});

test("a missed past scheduled day breaks the streak even when older check-ins exist", () => {
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-13", "2026-11-16", "2026-11-20"], today: "2026-11-20",
  }), 1);
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-13", "2026-11-16"], today: "2026-11-19",
  }), 0);
});

test("an unchecked scheduled today preserves the previous streak until local midnight", () => {
  const checkinDates = ["2026-11-13", "2026-11-16"];
  const beforeMidnight = localDateAt(new Date("2026-11-19T04:59:59Z"), "America/New_York");
  const afterMidnight = localDateAt(new Date("2026-11-19T05:00:00Z"), "America/New_York");
  assert.equal(calculateStreak({ weekdays, checkinDates, today: beforeMidnight }), 2);
  assert.equal(calculateStreak({ weekdays, checkinDates, today: afterMidnight }), 0);
});

test("checking in on a scheduled today immediately extends the streak", () => {
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-13", "2026-11-16", "2026-11-18"], today: "2026-11-18",
  }), 3);
});

test("unscheduled check-ins cannot add to or repair a streak", () => {
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"], today: "2026-11-17",
  }), 1);
  assert.equal(calculateStreak({
    weekdays, checkinDates: ["2026-11-16", "2026-11-19"], today: "2026-11-19",
  }), 0);
});

test("duplicate and future check-ins do not inflate the streak", () => {
  assert.equal(calculateStreak({
    weekdays: [1, 1, 3, 5],
    checkinDates: ["2026-11-16", "2026-11-16", "2026-11-18", "2026-11-20"],
    today: "2026-11-18",
  }), 2);
});

test("check-in timestamps use the profile timezone when determining the scheduled day", () => {
  const timestamp = new Date("2026-11-16T01:00:00Z");
  const losAngelesDate = localDateAt(timestamp, "America/Los_Angeles");
  const tokyoDate = localDateAt(timestamp, "Asia/Tokyo");
  assert.equal(calculateStreak({ weekdays: [7], checkinDates: [losAngelesDate], today: losAngelesDate }), 1);
  assert.equal(calculateStreak({ weekdays: [7], checkinDates: [tokyoDate], today: tokyoDate }), 0);
});

test("invalid scheduled weekdays and malformed check-in dates are rejected", () => {
  assert.throws(() => calculateStreak({ weekdays: [0], checkinDates: [], today: "2026-11-18" }), /weekdays/);
  assert.throws(() => calculateStreak({ weekdays: [1.5], checkinDates: [], today: "2026-11-18" }), /weekdays/);
  assert.throws(() => calculateStreak({ weekdays, checkinDates: ["2026-02-30"], today: "2026-11-18" }), /Invalid local date/);
});
