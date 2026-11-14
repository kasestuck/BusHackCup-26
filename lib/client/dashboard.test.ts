import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plan, Reward } from "@/lib/contract";
import {
  getNextReward,
  getNextSession,
  getTodaySession,
  getWeek,
  isoWeekday,
} from "./dashboard.ts";

const day = (weekday: number, focus: string) => ({
  weekday,
  focus,
  duration_min: 45,
  exercises: [],
});

const plan: Plan = {
  id: "p",
  title: "Test",
  summary: "",
  days: [day(1, "Lower"), day(3, "Push"), day(5, "Pull")],
  safety_note: "",
};

// 2026-11-14 is a Saturday; 2026-11-11 a Wednesday.
const saturday = new Date(2026, 10, 14, 9);
const wednesday = new Date(2026, 10, 11, 9);

test("isoWeekday maps Monday=1 … Sunday=7", () => {
  assert.equal(isoWeekday(new Date(2026, 10, 9)), 1);
  assert.equal(isoWeekday(saturday), 6);
  assert.equal(isoWeekday(new Date(2026, 10, 15)), 7);
});

test("getTodaySession finds today's day and its index", () => {
  assert.deepEqual(getTodaySession(plan, wednesday), { day: plan.days[1], dayIndex: 1 });
  assert.equal(getTodaySession(plan, saturday), null);
});

test("getNextSession wraps into next week and skips today", () => {
  const next = getNextSession(plan, saturday);
  assert.equal(next?.day.focus, "Lower");
  assert.equal(next?.daysAway, 2);
  assert.equal(getNextSession(plan, wednesday)?.day.focus, "Pull");
  assert.equal(getNextSession({ ...plan, days: [] }, saturday), null);
});

test("getWeek returns Mon–Sun with today and sessions marked", () => {
  const week = getWeek(plan, wednesday);
  assert.equal(week.length, 7);
  assert.equal(week[0].date.getDate(), 9);
  assert.equal(week.filter((c) => c.session).length, 3);
  assert.equal(week.findIndex((c) => c.isToday), 2);
  assert.deepEqual(
    week.map((c) => c.isPast),
    [true, true, false, false, false, false, false],
  );
  assert.equal(getWeek(null, wednesday).filter((c) => c.session).length, 0);
});

const reward = (id: string, cost: number, active = true): Reward => ({
  id,
  kind: "partner_product",
  title: id,
  partner_id: null,
  cost_coins: cost,
  discount_pct: null,
  active,
});

test("getNextReward targets the cheapest reward not yet affordable", () => {
  const rewards = [reward("pro", 1200), reward("r15", 500), reward("r25", 900), reward("off", 100, false)];
  const r = getNextReward(rewards, 640);
  assert.equal(r?.reward.id, "r25");
  assert.equal(r?.remaining, 260);
  assert.equal(r?.affordable, false);

  const rich = getNextReward(rewards, 5000);
  assert.equal(rich?.reward.id, "pro");
  assert.equal(rich?.affordable, true);

  assert.equal(getNextReward([], 100), null);
});
