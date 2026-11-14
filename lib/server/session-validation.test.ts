import assert from "node:assert/strict";
import { test } from "node:test";
import { ECONOMY } from "./economy.ts";
import { validateSessionLog } from "./session-validation.ts";

const planId = "10000000-0000-4000-8000-000000000001";
const slugs = Array.from({ length: 21 }, (_, index) => `exercise-${index}`);
const plan = { days: [
  { exercises: slugs.map((slug) => ({ slug })) },
  { exercises: [{ slug: "other-day-exercise" }] },
] };

function log(exerciseCount = 1, setsPerExercise = 1, reps = 10, weightKg = 0) {
  return {
    plan_id: planId,
    day_index: 0,
    exercises: slugs.slice(0, exerciseCount).map((slug) => ({
      slug,
      sets: Array.from({ length: setsPerExercise }, () => ({ reps, weight_kg: weightKg })),
    })),
  };
}

test("session validation accepts boundary values and counts completed sets", () => {
  assert.equal(validateSessionLog(log(1, 1, 1, 0), plan).success, true);
  assert.equal(validateSessionLog(log(1, 10, 100, 500), plan).success, true);
  assert.equal(validateSessionLog(log(20, 1, 1, 0.5), plan).success, true);
  const result = validateSessionLog(log(6, 10), plan);
  assert.equal(result.success, true);
  if (result.success) assert.equal(result.totalSets, ECONOMY.sessionLimits.maxTotalSets);
});

test("session validation rejects missing and excessive exercises and sets", () => {
  for (const input of [log(0), log(21), log(1, 0), log(1, 11), log(7, 10)]) {
    assert.equal(validateSessionLog(input, plan).success, false);
  }
});

test("repetitions must be integers within the operational bounds", () => {
  for (const reps of [-1, 0, 1.5, 101, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validateSessionLog(log(1, 1, reps), plan).success, false);
  }
});

test("weight must be finite and between zero and five hundred kilograms", () => {
  for (const weight of [-1, 500.01, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(validateSessionLog(log(1, 1, 10, weight), plan).success, false);
  }
});

test("the requested day must exist and slugs must belong to that day", () => {
  for (const dayIndex of [-1, 2, 6, 7, 0.5]) {
    assert.equal(validateSessionLog({ ...log(), day_index: dayIndex }, plan).success, false);
  }
  const wrongDay = { ...log(), day_index: 1 };
  assert.equal(validateSessionLog(wrongDay, plan).success, false);
  const unknownSlug = log();
  unknownSlug.exercises[0].slug = "unknown-exercise";
  assert.equal(validateSessionLog(unknownSlug, plan).success, false);
});

test("duplicate slugs and malformed logs or plan days are rejected", () => {
  const duplicate = log(2);
  duplicate.exercises[1].slug = duplicate.exercises[0].slug;
  assert.equal(validateSessionLog(duplicate, plan).success, false);
  assert.equal(validateSessionLog({ ...log(), user_id: planId }, plan).success, false);
  for (const invalidPlan of [null, [], {}, { days: [] }, { days: [null] }, { days: [{ exercises: [{}] }] }]) {
    assert.equal(validateSessionLog(log(), invalidPlan).success, false);
  }
});
