import { SessionsRequestSchema, type SessionsRequest } from "./contract.ts";
import { ECONOMY } from "./economy.ts";

export type SessionLogValidation =
  | { success: true; input: SessionsRequest; totalSets: number }
  | { success: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Validate the log against its selected plan day; ownership is checked separately. */
export function validateSessionLog(input: unknown, planJson: unknown): SessionLogValidation {
  const parsed = SessionsRequestSchema.safeParse(input);
  if (!parsed.success || !isRecord(planJson) || !Array.isArray(planJson.days)) {
    return { success: false };
  }

  const request = parsed.data;
  const day = planJson.days[request.day_index];
  if (!isRecord(day) || !Array.isArray(day.exercises) || day.exercises.length === 0) {
    return { success: false };
  }
  const allowedSlugs = new Set<string>();
  for (const exercise of day.exercises) {
    if (!isRecord(exercise) || typeof exercise.slug !== "string" || exercise.slug.length === 0) {
      return { success: false };
    }
    allowedSlugs.add(exercise.slug);
  }

  const limits = ECONOMY.sessionLimits;
  if (request.exercises.length > limits.maxExercises) return { success: false };
  let totalSets = 0;
  const seenSlugs = new Set<string>();
  for (const exercise of request.exercises) {
    if (!allowedSlugs.has(exercise.slug) || seenSlugs.has(exercise.slug)) return { success: false };
    seenSlugs.add(exercise.slug);
    if (exercise.sets.length > limits.maxSetsPerExercise) return { success: false };
    totalSets += exercise.sets.length;
    if (totalSets > limits.maxTotalSets) return { success: false };
    for (const set of exercise.sets) {
      if (set.reps > limits.maxReps || set.weight_kg > limits.maxWeightKg) {
        return { success: false };
      }
    }
  }
  return { success: true, input: request, totalSets };
}
