/**
 * ShowUp API contract — shared between frontend and backend.
 *
 * STATUS: DRAFT, transcribed from docs/SPEC.md §5–§8 by the frontend.
 * Per SPEC §4 this folder changes only by agreement of both developers.
 * The backend must review and approve it before it is merged into main.
 *
 * Where the spec gives only table fields (not exact JSON), the shape below mirrors
 * those table fields. Every such spot is marked `PROPOSAL:` so it is easy to review.
 */
import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enums (SPEC §5 "User questionnaire")                                */
/* ------------------------------------------------------------------ */

export const GoalSchema = z.enum([
  "lose_fat",
  "build_muscle",
  "get_stronger",
  "general_fitness",
  "endurance",
]);
export type Goal = z.infer<typeof GoalSchema>;

export const WorkoutTypeSchema = z.enum([
  "gym_strength",
  "home_bodyweight",
  "cardio_hiit",
  "mobility_yoga",
]);
export type WorkoutType = z.infer<typeof WorkoutTypeSchema>;

export const EquipmentSchema = z.enum(["full_gym", "dumbbells", "bands", "none"]);
export type Equipment = z.infer<typeof EquipmentSchema>;

export const SessionMinutesSchema = z.union([
  z.literal(20),
  z.literal(30),
  z.literal(45),
  z.literal(60),
  z.literal(75),
]);
export type SessionMinutes = z.infer<typeof SessionMinutesSchema>;

/** Weekday number 1–7. PROPOSAL: 1 = Monday (ISO 8601); the spec does not say. */
export const WeekdaySchema = z.number().int().min(1).max(7);
export type Weekday = z.infer<typeof WeekdaySchema>;

export const InjuryAreaSchema = z.enum([
  "knee",
  "lower back",
  "shoulder",
  "wrist",
  "ankle",
  "other",
]);
export type InjuryArea = z.infer<typeof InjuryAreaSchema>;

export const InjurySchema = z.object({
  area: InjuryAreaSchema,
  /** Approximate: month and year, or "N years ago". */
  when: z.string(),
  status: z.enum(["recovered", "ongoing"]),
});
export type Injury = z.infer<typeof InjurySchema>;

/* ------------------------------------------------------------------ */
/* Profile (SPEC §5 table `profiles`) — metric units in the API        */
/* ------------------------------------------------------------------ */

export const ProfileSchema = z.object({
  id: z.string(),
  display_name: z.string().nullable(),
  height_cm: z.number().nullable(),
  weight_kg: z.number().nullable(),
  goal: GoalSchema.nullable(),
  workout_types: z.array(WorkoutTypeSchema),
  session_minutes: SessionMinutesSchema.nullable(),
  weekdays: z.array(WeekdaySchema),
  injuries: z.array(InjurySchema),
  home_gym_id: z.string().nullable(),
  is_pro: z.boolean(),
});
export type Profile = z.infer<typeof ProfileSchema>;

/* ------------------------------------------------------------------ */
/* Plan (SPEC §8 "Plan shape returned by the API")                     */
/* ------------------------------------------------------------------ */

export const PlanExerciseSchema = z.object({
  slug: z.string(),
  name: z.string(),
  sets: z.number().int(),
  reps: z.string(),
  rest_sec: z.number().int(),
  note: z.string(),
  video: z.object({
    youtube_id: z.string(),
    title: z.string(),
  }),
});
export type PlanExercise = z.infer<typeof PlanExerciseSchema>;

export const PlanDaySchema = z.object({
  weekday: WeekdaySchema,
  focus: z.string(),
  duration_min: z.number().int(),
  exercises: z.array(PlanExerciseSchema),
});
export type PlanDay = z.infer<typeof PlanDaySchema>;

export const PlanSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  days: z.array(PlanDaySchema),
  safety_note: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

/* ------------------------------------------------------------------ */
/* Endpoints (SPEC §6)                                                 */
/* ------------------------------------------------------------------ */

/** GET /api/me */
export const MeResponseSchema = z.object({
  /** PROPOSAL: null until the questionnaire is submitted. */
  profile: ProfileSchema.nullable(),
  coins_balance: z.number().int(),
  /** PROPOSAL: integer count; the unit (days of check-ins) is not specified. */
  streak: z.number().int(),
  is_pro: z.boolean(),
  has_plan: z.boolean(),
});
export type MeResponse = z.infer<typeof MeResponseSchema>;

/** POST /api/onboarding — questionnaire (SPEC §5). UI converts ft/in → cm and lb → kg. */
export const OnboardingRequestSchema = z.object({
  height_cm: z.number().positive(),
  weight_kg: z.number().positive(),
  injuries: z.array(InjurySchema),
  goal: GoalSchema,
  workout_types: z.array(WorkoutTypeSchema).min(1),
  session_minutes: SessionMinutesSchema,
  weekdays: z.array(WeekdaySchema).min(1).max(7),
  /** "added by us" in the spec; PROPOSAL: needs a column in `profiles`. */
  equipment: z.array(EquipmentSchema).min(1),
  /** "added by us" in the spec, 18–70; PROPOSAL: needs a column in `profiles`. */
  age: z.number().int().min(18).max(70),
});
export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;

export const OnboardingResponseSchema = z.object({ profile: ProfileSchema });
export type OnboardingResponse = z.infer<typeof OnboardingResponseSchema>;

/** POST /api/plan/generate — body `{}` */
export const PlanGenerateRequestSchema = z.object({}).strict();
export const PlanResponseSchema = z.object({ plan: PlanSchema });
export type PlanResponse = z.infer<typeof PlanResponseSchema>;
/** GET /api/plan/active → PlanResponse or 404 */

/** POST /api/sessions */
export const SessionRequestSchema = z.object({
  plan_id: z.string(),
  day_index: z.number().int().min(0),
  exercises: z.array(
    z.object({
      slug: z.string(),
      sets: z.array(
        z.object({
          reps: z.number().int().min(0),
          weight_kg: z.number().min(0),
        }),
      ),
    }),
  ),
});
export type SessionRequest = z.infer<typeof SessionRequestSchema>;

export const SessionResponseSchema = z.object({
  xp_earned: z.number().int(),
  coins_earned: z.number().int(),
  balance: z.number().int(),
});
export type SessionResponse = z.infer<typeof SessionResponseSchema>;

/** GET /api/gyms */
export const GymSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  address: z.string(),
});
export type Gym = z.infer<typeof GymSchema>;
export const GymsResponseSchema = z.object({ gyms: z.array(GymSchema) });
export type GymsResponse = z.infer<typeof GymsResponseSchema>;

/** GET /api/gyms/:id/qr-token — header `x-gym-key` */
export const QrTokenResponseSchema = z.object({
  token: z.string(),
  expires_in: z.number().int(),
});
export type QrTokenResponse = z.infer<typeof QrTokenResponseSchema>;

/** POST /api/checkin → or 409 already_checked_in */
export const CheckinRequestSchema = z.object({
  gym_id: z.string(),
  token: z.string(),
});
export type CheckinRequest = z.infer<typeof CheckinRequestSchema>;
export const CheckinResponseSchema = z.object({
  coins_earned: z.number().int(),
  streak: z.number().int(),
  balance: z.number().int(),
});
export type CheckinResponse = z.infer<typeof CheckinResponseSchema>;

/** GET /api/rewards — PROPOSAL: item shape mirrors table `rewards`. */
export const RewardSchema = z.object({
  id: z.string(),
  kind: z.enum(["pro_month", "partner_product"]),
  title: z.string(),
  partner_id: z.string().nullable(),
  cost_coins: z.number().int(),
  discount_pct: z.number().nullable(),
  active: z.boolean(),
});
export type Reward = z.infer<typeof RewardSchema>;
export const RewardsResponseSchema = z.object({ rewards: z.array(RewardSchema) });
export type RewardsResponse = z.infer<typeof RewardsResponseSchema>;

/** POST /api/rewards/redeem → or 402 not_enough_coins */
export const RedeemRequestSchema = z.object({ reward_id: z.string() });
export type RedeemRequest = z.infer<typeof RedeemRequestSchema>;
export const RedeemResponseSchema = z.object({
  promo_code: z.string().optional(),
  pro_until: z.string().optional(),
  balance: z.number().int(),
});
export type RedeemResponse = z.infer<typeof RedeemResponseSchema>;

/** POST /api/billing/subscribe — simulated payment */
export const SubscribeRequestSchema = z.object({ plan: z.literal("pro_monthly") });
export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;
export const SubscribeResponseSchema = z.object({
  is_pro: z.boolean(),
  pro_until: z.string(),
});
export type SubscribeResponse = z.infer<typeof SubscribeResponseSchema>;

/** POST /api/nutrition/analyze — multipart field `image`; Pro only (402 pro_required) */
export const NutritionItemSchema = z.object({
  name: z.string(),
  grams_estimate: z.number(),
  kcal: z.number(),
  protein_g: z.number(),
  carbs_g: z.number(),
  fat_g: z.number(),
});
export type NutritionItem = z.infer<typeof NutritionItemSchema>;
export const NutritionResponseSchema = z.object({
  items: z.array(NutritionItemSchema),
  /** PROPOSAL: totals use the same macro fields as items. */
  totals: z.object({
    kcal: z.number(),
    protein_g: z.number(),
    carbs_g: z.number(),
    fat_g: z.number(),
  }),
  confidence: z.enum(["low", "medium", "high"]),
  disclaimer: z.string(),
});
export type NutritionResponse = z.infer<typeof NutritionResponseSchema>;

/** GET /api/partner/stats?partner_id= */
export const PartnerStatsResponseSchema = z.object({
  sales_count: z.number().int(),
  revenue_cents: z.number().int(),
  commission_cents: z.number().int(),
});
export type PartnerStatsResponse = z.infer<typeof PartnerStatsResponseSchema>;

/* ------------------------------------------------------------------ */
/* Errors (SPEC §6)                                                    */
/* ------------------------------------------------------------------ */

/** Codes named in the spec. Other codes may appear; treat them as generic errors. */
export const KNOWN_ERROR_CODES = [
  "not_enough_coins",
  "pro_required",
  "already_checked_in",
] as const;

export const ApiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});
export type ApiErrorBody = z.infer<typeof ApiErrorBodySchema>;

/** 401 no session · 402 Pro required / not enough coins · 409 repeat check-in · 422 invalid data · 429 too many AI requests */
export const HTTP_STATUS = {
  unauthorized: 401,
  paymentRequired: 402,
  notFound: 404,
  conflict: 409,
  invalid: 422,
  rateLimited: 429,
} as const;

export const API_ROUTES = {
  me: "/api/me",
  onboarding: "/api/onboarding",
  planGenerate: "/api/plan/generate",
  planActive: "/api/plan/active",
  sessions: "/api/sessions",
  gyms: "/api/gyms",
  gymQrToken: (gymId: string) => `/api/gyms/${encodeURIComponent(gymId)}/qr-token`,
  checkin: "/api/checkin",
  rewards: "/api/rewards",
  rewardsRedeem: "/api/rewards/redeem",
  billingSubscribe: "/api/billing/subscribe",
  nutritionAnalyze: "/api/nutrition/analyze",
  partnerStats: (partnerId: string) =>
    `/api/partner/stats?partner_id=${encodeURIComponent(partnerId)}`,
} as const;
