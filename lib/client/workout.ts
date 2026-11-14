/**
 * Workout logging (SPEC §6 POST /api/sessions). Pure — runs under `node --test`.
 * The UI works in lb; the API takes weight_kg.
 */
import type { Plan, PlanDay, SessionRequest } from "@/lib/contract";
import { lbToKg } from "./units.ts";

export type SetLog = { weightLb: string; reps: string; done: boolean };
export type WorkoutLog = { startedAt: number; exercises: SetLog[][] };

export type TargetReps = { value: number | null; unit: "reps" | "sec" };

/** "8-10" → 8 reps, "30-45 sec" → 30 sec, "AMRAP" → no default. */
export function parseTargetReps(reps: string): TargetReps {
  const unit = /\bsec|\bs\b|second/i.test(reps) ? "sec" : "reps";
  const m = reps.match(/\d+/);
  return { value: m ? Number(m[0]) : null, unit };
}

export function initialLog(day: PlanDay, now: number): WorkoutLog {
  return {
    startedAt: now,
    exercises: day.exercises.map((ex) =>
      Array.from({ length: Math.max(1, ex.sets) }, () => ({ weightLb: "", reps: "", done: false })),
    ),
  };
}

const isWhole = (s: string) => /^\d+$/.test(s.trim());
const isWeight = (s: string) => s.trim() === "" || /^\d+(\.\d+)?$/.test(s.trim());

/** A set can be marked done once its reps are a whole number and weight is empty or numeric. */
export function setError(s: SetLog): "reps" | "weight" | null {
  if (!isWhole(s.reps) || Number(s.reps) === 0) return "reps";
  if (!isWeight(s.weightLb)) return "weight";
  return null;
}

export function countSets(log: WorkoutLog): { done: number; total: number } {
  let done = 0;
  let total = 0;
  for (const sets of log.exercises) {
    total += sets.length;
    done += sets.filter((s) => s.done).length;
  }
  return { done, total };
}

/** Only completed sets are sent; exercises with none are left out. Empty weight = bodyweight (0 kg). */
export function toSessionRequest(plan: Plan, dayIndex: number, log: WorkoutLog): SessionRequest {
  const day = plan.days[dayIndex];
  return {
    plan_id: plan.id,
    day_index: dayIndex,
    exercises: day.exercises
      .map((ex, i) => ({
        slug: ex.slug,
        sets: (log.exercises[i] ?? [])
          .filter((s) => s.done)
          .map((s) => ({
            reps: Number(s.reps),
            weight_kg: s.weightLb.trim() === "" ? 0 : lbToKg(Number(s.weightLb)),
          })),
      }))
      .filter((e) => e.sets.length > 0),
  };
}

/** 75 → "1:15", 3725 → "1:02:05" */
export function formatElapsed(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

export function draftKey(planId: string, dayIndex: number) {
  return `showup.workout.${planId}.${dayIndex}`;
}

/** Validates a stored draft against the current day's shape; returns null if it doesn't fit. */
export function restoreLog(raw: string | null, day: PlanDay): WorkoutLog | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as WorkoutLog;
    if (typeof v.startedAt !== "number" || !Array.isArray(v.exercises)) return null;
    if (v.exercises.length !== day.exercises.length) return null;
    const ok = v.exercises.every(
      (sets) =>
        Array.isArray(sets) &&
        sets.every((s) => typeof s.reps === "string" && typeof s.weightLb === "string" && typeof s.done === "boolean"),
    );
    return ok ? v : null;
  } catch {
    return null;
  }
}
