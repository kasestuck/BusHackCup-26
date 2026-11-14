import { test } from "node:test";
import assert from "node:assert/strict";
import type { Plan } from "@/lib/contract";
import {
  countSets,
  formatElapsed,
  initialLog,
  parseTargetReps,
  restoreLog,
  setError,
  toSessionRequest,
} from "./workout.ts";

const ex = (slug: string, sets: number, reps = "8-10") => ({
  slug,
  name: slug,
  sets,
  reps,
  rest_sec: 60,
  note: "",
  video: { youtube_id: "x", title: "x" },
});

const plan: Plan = {
  id: "plan-1",
  title: "T",
  summary: "",
  days: [{ weekday: 1, focus: "Lower", duration_min: 45, exercises: [ex("squat", 3), ex("plank", 2, "30-45 sec")] }],
  safety_note: "",
};

test("parseTargetReps reads the first number and detects timed sets", () => {
  assert.deepEqual(parseTargetReps("8-10"), { value: 8, unit: "reps" });
  assert.deepEqual(parseTargetReps("30-45 sec"), { value: 30, unit: "sec" });
  assert.deepEqual(parseTargetReps("10 each leg"), { value: 10, unit: "reps" });
  assert.deepEqual(parseTargetReps("AMRAP"), { value: null, unit: "reps" });
});

test("initialLog creates one row per target set", () => {
  const log = initialLog(plan.days[0], 1000);
  assert.equal(log.startedAt, 1000);
  assert.deepEqual(log.exercises.map((s) => s.length), [3, 2]);
  assert.deepEqual(countSets(log), { done: 0, total: 5 });
});

test("setError requires whole reps > 0 and a numeric or empty weight", () => {
  assert.equal(setError({ reps: "", weightLb: "", done: false }), "reps");
  assert.equal(setError({ reps: "0", weightLb: "", done: false }), "reps");
  assert.equal(setError({ reps: "8.5", weightLb: "", done: false }), "reps");
  assert.equal(setError({ reps: "8", weightLb: "abc", done: false }), "weight");
  assert.equal(setError({ reps: "8", weightLb: "", done: false }), null);
  assert.equal(setError({ reps: "8", weightLb: "135.5", done: false }), null);
});

test("toSessionRequest sends only completed sets, converts lb → kg", () => {
  const log = initialLog(plan.days[0], 0);
  log.exercises[0][0] = { weightLb: "135", reps: "8", done: true };
  log.exercises[0][1] = { weightLb: "135", reps: "7", done: false };
  log.exercises[0][2] = { weightLb: "", reps: "10", done: true };
  assert.deepEqual(toSessionRequest(plan, 0, log), {
    plan_id: "plan-1",
    day_index: 0,
    exercises: [{ slug: "squat", sets: [{ reps: 8, weight_kg: 61.2 }, { reps: 10, weight_kg: 0 }] }],
  });
});

test("formatElapsed", () => {
  assert.equal(formatElapsed(75), "1:15");
  assert.equal(formatElapsed(3725), "1:02:05");
});

test("restoreLog accepts only drafts matching the day's shape", () => {
  const good = JSON.stringify(initialLog(plan.days[0], 5));
  assert.equal(restoreLog(good, plan.days[0])?.startedAt, 5);
  assert.equal(restoreLog(JSON.stringify({ startedAt: 1, exercises: [[]] }), plan.days[0]), null);
  assert.equal(restoreLog("not json", plan.days[0]), null);
  assert.equal(restoreLog(null, plan.days[0]), null);
});
