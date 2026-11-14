import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateWorkoutXp } from "./economy.ts";

test("completed sets earn five XP each, including zero sets", () => {
  assert.equal(calculateWorkoutXp(0), 0);
  assert.equal(calculateWorkoutXp(1), 5);
  assert.equal(calculateWorkoutXp(7), 35);
});

test("workout XP is capped at one hundred", () => {
  assert.equal(calculateWorkoutXp(19), 95);
  assert.equal(calculateWorkoutXp(20), 100);
  assert.equal(calculateWorkoutXp(21), 100);
  assert.equal(calculateWorkoutXp(Number.MAX_SAFE_INTEGER), 100);
});

test("negative, fractional and non-finite set counts are rejected", () => {
  for (const count of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculateWorkoutXp(count), /nonnegative safe integer/);
  }
});
