/** Central business values; this module has no runtime or framework dependencies. */
export const ECONOMY = Object.freeze({
  coins: Object.freeze({
    firstPlan: 20,
    workoutSession: 10,
    gymCheckin: 40,
    weeklyBonus: 50,
  }),
  rewardCosts: Object.freeze({
    proMonth: 1200,
    partnerDiscount15: 500,
    partnerDiscount25: 900,
  }),
  discountPct: Object.freeze({
    partnerDiscount15: 15,
    partnerDiscount25: 25,
  }),
  xp: Object.freeze({ perSet: 5, maxPerSession: 100 }),
  planLimits: Object.freeze({ freePerWeek: 1, proPerDay: 10 }),
  sessionLimits: Object.freeze({
    maxExercises: 20,
    maxSetsPerExercise: 10,
    maxTotalSets: 60,
    maxReps: 100,
    maxWeightKg: 500,
  }),
  qrWindowSeconds: 60,
  rateLimits: Object.freeze({
    windowSeconds: 60,
    qrPerIp: 60,
    qrPerKey: 300,
    checkinPerUser: 10,
    maxEntries: 10_000,
  }),
  partnerCommissionPct: 15,
  gymCommissionPct: 0,
  proMonthlyPriceCents: 1299,
  proPeriodDays: 30,
});

/** Award five XP per completed set, capped at one hundred XP per session. */
export function calculateWorkoutXp(totalSets: number): number {
  if (!Number.isSafeInteger(totalSets) || totalSets < 0) {
    throw new RangeError("The total set count must be a nonnegative safe integer.");
  }
  return Math.min(ECONOMY.xp.maxPerSession, ECONOMY.xp.perSet * totalSets);
}
