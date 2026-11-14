import { test } from "node:test";
import assert from "node:assert/strict";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "./units.ts";
import {
  EMPTY_DRAFT,
  type OnboardingDraft,
  toOnboardingRequest,
  toggleEquipment,
  validateStep,
} from "./onboarding.ts";

test("unit conversions round-trip", () => {
  assert.equal(ftInToCm(5, 10), 177.8);
  assert.deepEqual(cmToFtIn(177.8), { ft: 5, in: 10 });
  assert.equal(lbToKg(180), 81.6);
  assert.equal(kgToLb(81.6), 180);
});

const filled: OnboardingDraft = {
  ...EMPTY_DRAFT,
  age: "32",
  heightFt: "5",
  heightIn: "10",
  weightLb: "180",
  hasInjuries: true,
  injuries: [{ key: "a", area: "knee", when: " 2 years ago ", status: "recovered" }],
  goal: "build_muscle",
  workoutTypes: ["gym_strength"],
  equipment: ["full_gym"],
  sessionMinutes: 45,
  weekdays: [5, 1, 3],
};

test("basics validation enforces age 18–70 and sane height/weight", () => {
  assert.deepEqual(validateStep("basics", filled), {});
  const bad = validateStep("basics", { ...filled, age: "17", heightIn: "12", weightLb: "abc" });
  assert.ok(bad.age && bad.height && bad.weight);
  assert.deepEqual(validateStep("basics", { ...filled, heightIn: "" }), {});
});

test("injuries step requires an answer and complete entries", () => {
  assert.ok(validateStep("injuries", EMPTY_DRAFT).hasInjuries);
  assert.deepEqual(validateStep("injuries", { ...EMPTY_DRAFT, hasInjuries: false }), {});
  const incomplete = validateStep("injuries", {
    ...filled,
    injuries: [{ key: "x", area: null, when: "", status: null }],
  });
  assert.deepEqual(Object.keys(incomplete).sort(), ["x.area", "x.status", "x.when"]);
});

test("'none' equipment is exclusive", () => {
  assert.deepEqual(toggleEquipment(["dumbbells", "bands"], "none"), ["none"]);
  assert.deepEqual(toggleEquipment(["none"], "dumbbells"), ["dumbbells"]);
  assert.deepEqual(toggleEquipment(["dumbbells"], "dumbbells"), []);
});

test("toOnboardingRequest converts to metric and sorts weekdays", () => {
  assert.deepEqual(toOnboardingRequest(filled), {
    age: 32,
    height_cm: 177.8,
    weight_kg: 81.6,
    injuries: [{ area: "knee", when: "2 years ago", status: "recovered" }],
    goal: "build_muscle",
    workout_types: ["gym_strength"],
    equipment: ["full_gym"],
    session_minutes: 45,
    weekdays: [1, 3, 5],
  });
  assert.deepEqual(toOnboardingRequest({ ...filled, hasInjuries: false }).injuries, []);
});
