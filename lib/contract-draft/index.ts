import { z } from "zod";

export const UuidSchema = z.string().uuid();
export const TextSchema = z.string().min(1);
export const TimestampSchema = z.string().datetime({ offset: true });
export const TimezoneSchema = z.string().min(1).refine((value) => {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}, { message: "Invalid timezone." });
export const CountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const CoinsSchema = CountSchema;
export const WeekdaySchema = z.number().int().min(1).max(7);
export const NoRequestSchema = z.undefined();
export const EmptyRequestSchema = z.object({}).strict();

export const GoalSchema = z.enum([
  "lose_fat", "build_muscle", "get_stronger", "general_fitness", "endurance",
]);
export const WorkoutTypeSchema = z.enum([
  "gym_strength", "home_bodyweight", "cardio_hiit", "mobility_yoga",
]);
export const EquipmentSchema = z.enum(["full_gym", "dumbbells", "bands", "none"]);
export const SessionMinutesSchema = z.union([
  z.literal(20), z.literal(30), z.literal(45), z.literal(60), z.literal(75),
]);
export const InjurySchema = z.object({
  area: z.enum(["knee", "lower back", "shoulder", "wrist", "ankle", "other"]),
  when: TextSchema,
  status: z.enum(["recovered", "ongoing"]),
}).strict();
export const WeekdaysSchema = z.array(WeekdaySchema).min(1).max(7)
  .refine((values) => new Set(values).size === values.length, {
    message: "Weekdays must be unique.",
  });
export const WorkoutTypesSchema = z.array(WorkoutTypeSchema).min(1)
  .refine((values) => new Set(values).size === values.length, {
    message: "Workout types must be unique.",
  });
export const EquipmentListSchema = z.array(EquipmentSchema).min(1)
  .refine((values) => new Set(values).size === values.length, {
    message: "Equipment values must be unique.",
  })
  .refine((values) => !values.includes("none") || values.length === 1, {
    message: "None cannot be combined with other equipment.",
  });

export const QuestionnaireSchema = z.object({
  height_cm: z.number().positive(),
  weight_kg: z.number().positive(),
  injuries: z.array(InjurySchema),
  goal: GoalSchema,
  workout_types: WorkoutTypesSchema,
  session_minutes: SessionMinutesSchema,
  weekdays: WeekdaysSchema,
  equipment: EquipmentListSchema,
  age: z.number().int().min(18).max(70),
}).strict();

export const ProfileSchema = z.object({
  id: UuidSchema,
  timezone: TimezoneSchema,
  display_name: z.string(),
  height_cm: z.number().positive().nullable(),
  weight_kg: z.number().positive().nullable(),
  goal: GoalSchema.nullable(),
  workout_types: z.array(WorkoutTypeSchema),
  session_minutes: SessionMinutesSchema.nullable(),
  weekdays: z.array(WeekdaySchema),
  injuries: z.array(InjurySchema),
  home_gym_id: UuidSchema.nullable(),
  is_pro: z.boolean(),
  equipment: z.array(EquipmentSchema),
  age: z.number().int().min(18).max(70).nullable(),
}).strict();
export const CompletedProfileSchema = ProfileSchema.extend(QuestionnaireSchema.shape);

export const GymSchema = z.object({
  id: UuidSchema,
  name: TextSchema,
  city: TextSchema,
  address: TextSchema,
}).strict();

export const RewardBaseSchema = z.object({
  id: UuidSchema,
  title: TextSchema,
  cost_coins: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  active: z.boolean(),
}).strict();
export const RewardSchema = z.discriminatedUnion("kind", [
  RewardBaseSchema.extend({
    kind: z.literal("pro_month"),
    partner_id: z.null(),
    discount_pct: z.null(),
  }),
  RewardBaseSchema.extend({
    kind: z.literal("partner_product"),
    partner_id: UuidSchema,
    discount_pct: z.number().positive().max(100),
  }),
]);

export type Questionnaire = z.infer<typeof QuestionnaireSchema>;
export type Injury = z.infer<typeof InjurySchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type CompletedProfile = z.infer<typeof CompletedProfileSchema>;
export type Gym = z.infer<typeof GymSchema>;
export type Reward = z.infer<typeof RewardSchema>;


export const PlanExerciseSchema = z.object({
  slug: TextSchema,
  name: TextSchema,
  sets: z.number().int().positive(),
  reps: TextSchema,
  rest_sec: CountSchema,
  note: z.string(),
  video: z.object({
    youtube_id: z.string().regex(new RegExp("^[A-Za-z0-9_-]{11}$")),
    title: TextSchema,
  }).strict(),
}).strict();

export const PlanDaySchema = z.object({
  weekday: WeekdaySchema,
  focus: TextSchema,
  duration_min: SessionMinutesSchema,
  exercises: z.array(PlanExerciseSchema).min(1),
}).strict();

export const PlanSchema = z.object({
  id: UuidSchema,
  title: TextSchema,
  summary: TextSchema,
  days: z.array(PlanDaySchema).min(1).max(7),
  safety_note: TextSchema,
}).strict().refine(
  (plan) => new Set(plan.days.map((day) => day.weekday)).size === plan.days.length,
  { message: "Plan weekdays must be unique." },
);

export const AiPlanExerciseSchema = PlanExerciseSchema.omit({
  name: true, video: true,
});
export const AiPlanDaySchema = PlanDaySchema.extend({
  exercises: z.array(AiPlanExerciseSchema).min(1),
});
export const AiPlanSchema = z.object({
  id: UuidSchema,
  title: TextSchema,
  summary: TextSchema,
  days: z.array(AiPlanDaySchema).min(1).max(7),
  safety_note: TextSchema,
}).strict();

export function planSchemaFor(
  profile: Questionnaire,
  allowedSlugs: ReadonlySet<string>,
) {
  return PlanSchema.superRefine((plan, context) => {
    const weekdays = plan.days.map((day) => day.weekday);
    if (
      weekdays.length !== profile.weekdays.length ||
      profile.weekdays.some((weekday) => !weekdays.includes(weekday))
    ) {
      context.addIssue({
        code: "custom",
        path: ["days"],
        message: "Plan days must match the selected weekdays.",
      });
    }
    plan.days.forEach((day, dayIndex) => {
      if (day.duration_min !== profile.session_minutes) {
        context.addIssue({
          code: "custom",
          path: ["days", dayIndex, "duration_min"],
          message: "Plan duration must match the selected session duration.",
        });
      }
      day.exercises.forEach((exercise, exerciseIndex) => {
        if (!allowedSlugs.has(exercise.slug)) {
          context.addIssue({
            code: "custom",
            path: ["days", dayIndex, "exercises", exerciseIndex, "slug"],
            message: "Exercise is not in the allowed catalog.",
          });
        }
      });
    });
  });
}

export type PlanExercise = z.infer<typeof PlanExerciseSchema>;
export type PlanDay = z.infer<typeof PlanDaySchema>;
export type Plan = z.infer<typeof PlanSchema>;
export type AiPlan = z.infer<typeof AiPlanSchema>;


export function errorBody<const Code extends string>(code: Code) {
  return z.object({
    error: z.object({
      code: z.literal(code),
      message: TextSchema,
    }).strict(),
  }).strict();
}

export function httpError<const Status extends number, Body extends z.ZodType>(
  status: Status,
  body: Body,
) {
  return z.object({ status: z.literal(status), body }).strict();
}

export const InvalidQrTokenErrorSchema = errorBody("invalid_qr_token");
export const RewardNotFoundErrorSchema = errorBody("reward_not_found");
export const RewardInactiveErrorSchema = errorBody("reward_inactive");
export const RedemptionNotFoundErrorSchema = errorBody("redemption_not_found");
export const AlreadyPurchasedErrorSchema = errorBody("already_purchased");
export const PartnerNotFoundErrorSchema = errorBody("partner_not_found");
export const UnauthorizedErrorSchema = errorBody("unauthorized");
export const InvalidGymKeyErrorSchema = errorBody("invalid_gym_key");
export const GymNotFoundErrorSchema = errorBody("gym_not_found");
export const CatalogUnavailableErrorSchema = errorBody("catalog_unavailable");
export const AiUnavailableErrorSchema = errorBody("ai_unavailable");
export const InsufficientCoinsErrorSchema = errorBody("not_enough_coins");
export const ProRequiredErrorSchema = errorBody("pro_required");
export const PlanNotFoundErrorSchema = errorBody("plan_not_found");
export const AlreadyCheckedInErrorSchema = errorBody("already_checked_in");
export const ValidationErrorSchema = errorBody("validation_error");
export const RateLimitedErrorSchema = errorBody("rate_limited");
export const InternalErrorSchema = z.object({
  error: z.object({
    code: z.literal("internal_error"),
    message: z.literal("An unexpected error occurred."),
  }).strict(),
}).strict();

export const InvalidQrTokenResponseSchema = httpError(422, InvalidQrTokenErrorSchema);
export const RewardNotFoundResponseSchema = httpError(404, RewardNotFoundErrorSchema);
export const RewardInactiveResponseSchema = httpError(409, RewardInactiveErrorSchema);
export const RedemptionNotFoundResponseSchema = httpError(404, RedemptionNotFoundErrorSchema);
export const AlreadyPurchasedResponseSchema = httpError(409, AlreadyPurchasedErrorSchema);
export const PartnerNotFoundResponseSchema = httpError(404, PartnerNotFoundErrorSchema);
export const UnauthorizedResponseSchema = httpError(401, UnauthorizedErrorSchema);
export const InvalidGymKeyResponseSchema = httpError(401, InvalidGymKeyErrorSchema);
export const GymNotFoundResponseSchema = httpError(404, GymNotFoundErrorSchema);
export const CatalogUnavailableResponseSchema = httpError(503, CatalogUnavailableErrorSchema);
export const AiUnavailableResponseSchema = httpError(503, AiUnavailableErrorSchema);
export const InsufficientCoinsResponseSchema = httpError(402, InsufficientCoinsErrorSchema);
export const ProRequiredResponseSchema = httpError(402, ProRequiredErrorSchema);
export const PlanNotFoundResponseSchema = httpError(404, PlanNotFoundErrorSchema);
export const AlreadyCheckedInResponseSchema = httpError(409, AlreadyCheckedInErrorSchema);
export const ValidationResponseSchema = httpError(422, ValidationErrorSchema);
export const RateLimitedResponseSchema = httpError(429, RateLimitedErrorSchema);
export const InternalErrorResponseSchema = httpError(500, InternalErrorSchema);

export const ApiErrorSchema = z.union([
  InvalidQrTokenErrorSchema, RewardNotFoundErrorSchema, RewardInactiveErrorSchema, RedemptionNotFoundErrorSchema, AlreadyPurchasedErrorSchema, PartnerNotFoundErrorSchema,
  CatalogUnavailableErrorSchema, AiUnavailableErrorSchema,
  GymNotFoundErrorSchema,
  UnauthorizedErrorSchema, InvalidGymKeyErrorSchema, InsufficientCoinsErrorSchema,
  ProRequiredErrorSchema, PlanNotFoundErrorSchema, AlreadyCheckedInErrorSchema,
  ValidationErrorSchema, RateLimitedErrorSchema,
  InternalErrorSchema,
]);
export const ApiErrorResponseSchema = z.union([
  InvalidQrTokenResponseSchema, RewardNotFoundResponseSchema, RewardInactiveResponseSchema, RedemptionNotFoundResponseSchema, AlreadyPurchasedResponseSchema, PartnerNotFoundResponseSchema,
  CatalogUnavailableResponseSchema, AiUnavailableResponseSchema,
  GymNotFoundResponseSchema,
  UnauthorizedResponseSchema, InvalidGymKeyResponseSchema,
  InsufficientCoinsResponseSchema, ProRequiredResponseSchema,
  PlanNotFoundResponseSchema, AlreadyCheckedInResponseSchema,
  ValidationResponseSchema, RateLimitedResponseSchema,
  InternalErrorResponseSchema,
]);
export type InvalidQrTokenError = z.infer<typeof InvalidQrTokenErrorSchema>;
export type InvalidQrTokenResponse = z.infer<typeof InvalidQrTokenResponseSchema>;
export type RewardNotFoundError = z.infer<typeof RewardNotFoundErrorSchema>;
export type RewardNotFoundResponse = z.infer<typeof RewardNotFoundResponseSchema>;
export type RewardInactiveError = z.infer<typeof RewardInactiveErrorSchema>;
export type RewardInactiveResponse = z.infer<typeof RewardInactiveResponseSchema>;
export type RedemptionNotFoundError = z.infer<typeof RedemptionNotFoundErrorSchema>;
export type RedemptionNotFoundResponse = z.infer<typeof RedemptionNotFoundResponseSchema>;
export type AlreadyPurchasedError = z.infer<typeof AlreadyPurchasedErrorSchema>;
export type AlreadyPurchasedResponse = z.infer<typeof AlreadyPurchasedResponseSchema>;
export type PartnerNotFoundError = z.infer<typeof PartnerNotFoundErrorSchema>;
export type PartnerNotFoundResponse = z.infer<typeof PartnerNotFoundResponseSchema>;
export type InternalError = z.infer<typeof InternalErrorSchema>;
export type CatalogUnavailableError = z.infer<typeof CatalogUnavailableErrorSchema>;
export type CatalogUnavailableResponse = z.infer<typeof CatalogUnavailableResponseSchema>;
export type AiUnavailableError = z.infer<typeof AiUnavailableErrorSchema>;
export type AiUnavailableResponse = z.infer<typeof AiUnavailableResponseSchema>;
export type GymNotFoundError = z.infer<typeof GymNotFoundErrorSchema>;
export type GymNotFoundResponse = z.infer<typeof GymNotFoundResponseSchema>;
export type InternalErrorResponse = z.infer<typeof InternalErrorResponseSchema>;
export type ApiError = z.infer<typeof ApiErrorSchema>;
export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;

export const ErrorMessageExamples = {
  invalid_qr_token: "The QR token is invalid or expired.",
  reward_not_found: "The reward was not found.",
  reward_inactive: "The reward is not active.",
  redemption_not_found: "The redemption was not found.",
  already_purchased: "A purchase has already been recorded for this redemption.",
  partner_not_found: "The partner was not found.",
  unauthorized: "Sign in to continue.",
  invalid_gym_key: "The gym key is invalid.",
  gym_not_found: "The gym was not found.",
  catalog_unavailable: "Not enough verified exercises are available for this plan.",
  ai_unavailable: "Nutrition analysis is temporarily unavailable. Please try again later.",
  not_enough_coins: "You need 400 more coins.",
  pro_required: "An active Pro subscription is required.",
  plan_not_found: "No active workout plan was found.",
  already_checked_in: "You have already checked in today.",
  validation_error: "The request contains invalid data.",
  rate_limited: "Too many requests. Please try again later.",
  internal_error: "An unexpected error occurred.",
} as const;


export const MeRequestSchema = NoRequestSchema;
export const MeSuccessSchema = z.object({
  profile: ProfileSchema.nullable(),
  coins_balance: CoinsSchema,
  streak: CountSchema,
  is_pro: z.boolean(),
  has_plan: z.boolean(),
}).strict();
export const MeErrorSchema = z.union([
  UnauthorizedErrorSchema, InternalErrorSchema,
]);
export const MeErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, InternalErrorResponseSchema,
]);

export type MeRequest = z.infer<typeof MeRequestSchema>;
export type MeSuccess = z.infer<typeof MeSuccessSchema>;
export type MeError = z.infer<typeof MeErrorSchema>;
export type MeErrorResponse = z.infer<typeof MeErrorResponseSchema>;


export const OnboardingRequestSchema = QuestionnaireSchema.extend({
  timezone: TimezoneSchema.optional(),
  display_name: z.string().optional(),
  home_gym_id: UuidSchema.nullable().optional(),
}).strict();
export const OnboardingSuccessSchema = z.object({
  profile: CompletedProfileSchema,
}).strict();
export const OnboardingErrorSchema = z.union([
  UnauthorizedErrorSchema, ValidationErrorSchema,
  InternalErrorSchema,
]);
export const OnboardingErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ValidationResponseSchema,
  InternalErrorResponseSchema,
]);

export type OnboardingRequest = z.infer<typeof OnboardingRequestSchema>;
export type OnboardingSuccess = z.infer<typeof OnboardingSuccessSchema>;
export type OnboardingError = z.infer<typeof OnboardingErrorSchema>;
export type OnboardingErrorResponse = z.infer<typeof OnboardingErrorResponseSchema>;


export const GeneratePlanRequestSchema = EmptyRequestSchema;
export const GeneratePlanSuccessSchema = z.object({ plan: PlanSchema }).strict();
export const GeneratePlanErrorSchema = z.union([
  UnauthorizedErrorSchema, ValidationErrorSchema, RateLimitedErrorSchema,
  ProRequiredErrorSchema, CatalogUnavailableErrorSchema,
  InternalErrorSchema,
]);
export const GeneratePlanErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ValidationResponseSchema, RateLimitedResponseSchema,
  ProRequiredResponseSchema, CatalogUnavailableResponseSchema,
  InternalErrorResponseSchema,
]);

export type GeneratePlanRequest = z.infer<typeof GeneratePlanRequestSchema>;
export type GeneratePlanSuccess = z.infer<typeof GeneratePlanSuccessSchema>;
export type GeneratePlanError = z.infer<typeof GeneratePlanErrorSchema>;
export type GeneratePlanErrorResponse = z.infer<typeof GeneratePlanErrorResponseSchema>;


export const ActivePlanRequestSchema = NoRequestSchema;
export const ActivePlanSuccessSchema = z.object({ plan: PlanSchema }).strict();
export const ActivePlanErrorSchema = z.union([
  UnauthorizedErrorSchema, PlanNotFoundErrorSchema,
  InternalErrorSchema,
]);
export const ActivePlanErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, PlanNotFoundResponseSchema,
  InternalErrorResponseSchema,
]);

export type ActivePlanRequest = z.infer<typeof ActivePlanRequestSchema>;
export type ActivePlanSuccess = z.infer<typeof ActivePlanSuccessSchema>;
export type ActivePlanError = z.infer<typeof ActivePlanErrorSchema>;
export type ActivePlanErrorResponse = z.infer<typeof ActivePlanErrorResponseSchema>;


export const SessionSetSchema = z.object({
  reps: z.number().int().positive(),
  weight_kg: z.number().nonnegative(),
}).strict();
export const SessionExerciseSchema = z.object({
  slug: TextSchema,
  sets: z.array(SessionSetSchema).min(1),
}).strict();
export const SessionsRequestSchema = z.object({
  plan_id: UuidSchema,
  day_index: z.number().int().min(0).max(6),
  exercises: z.array(SessionExerciseSchema).min(1),
}).strict();
export const SessionsSuccessSchema = z.object({
  xp_earned: CountSchema,
  coins_earned: CoinsSchema,
  balance: CoinsSchema,
}).strict();
export const SessionsErrorSchema = z.union([
  UnauthorizedErrorSchema, ValidationErrorSchema,
  InternalErrorSchema,
]);
export const SessionsErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ValidationResponseSchema,
  InternalErrorResponseSchema,
]);

export type SessionsRequest = z.infer<typeof SessionsRequestSchema>;
export type SessionsSuccess = z.infer<typeof SessionsSuccessSchema>;
export type SessionsError = z.infer<typeof SessionsErrorSchema>;
export type SessionsErrorResponse = z.infer<typeof SessionsErrorResponseSchema>;


export const GymsRequestSchema = NoRequestSchema;
export const GymsSuccessSchema = z.object({
  gyms: z.array(GymSchema),
}).strict();
export const GymsErrorSchema = z.union([
  UnauthorizedErrorSchema, InternalErrorSchema,
]);
export const GymsErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, InternalErrorResponseSchema,
]);

export type GymsRequest = z.infer<typeof GymsRequestSchema>;
export type GymsSuccess = z.infer<typeof GymsSuccessSchema>;
export type GymsError = z.infer<typeof GymsErrorSchema>;
export type GymsErrorResponse = z.infer<typeof GymsErrorResponseSchema>;


export const GymQrTokenRequestSchema = z.object({
  params: z.object({ id: UuidSchema }).strict(),
  headers: z.object({ "x-gym-key": TextSchema }).strict(),
}).strict();
export const GymQrTokenSuccessSchema = z.object({
  token: TextSchema,
  expires_in: z.number().int().positive(),
}).strict();
export const GymQrTokenErrorSchema = z.union([
  UnauthorizedErrorSchema, InvalidGymKeyErrorSchema, ValidationErrorSchema,
  GymNotFoundErrorSchema, RateLimitedErrorSchema,
  InternalErrorSchema,
]);
export const GymQrTokenErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, InvalidGymKeyResponseSchema, ValidationResponseSchema,
  GymNotFoundResponseSchema, RateLimitedResponseSchema,
  InternalErrorResponseSchema,
]);

export type GymQrTokenRequest = z.infer<typeof GymQrTokenRequestSchema>;
export type GymQrTokenSuccess = z.infer<typeof GymQrTokenSuccessSchema>;
export type GymQrTokenError = z.infer<typeof GymQrTokenErrorSchema>;
export type GymQrTokenErrorResponse = z.infer<typeof GymQrTokenErrorResponseSchema>;


export const CheckinRequestSchema = z.object({
  gym_id: UuidSchema,
  token: TextSchema,
}).strict();
export const CheckinSuccessSchema = z.object({
  coins_earned: CoinsSchema,
  streak: CountSchema,
  balance: CoinsSchema,
}).strict();
export const CheckinErrorSchema = z.union([
  InvalidQrTokenErrorSchema,
  UnauthorizedErrorSchema, AlreadyCheckedInErrorSchema,
  ValidationErrorSchema, RateLimitedErrorSchema,
  InternalErrorSchema,
]);
export const CheckinErrorResponseSchema = z.union([
  InvalidQrTokenResponseSchema,
  UnauthorizedResponseSchema, AlreadyCheckedInResponseSchema,
  ValidationResponseSchema, RateLimitedResponseSchema,
  InternalErrorResponseSchema,
]);

export type CheckinRequest = z.infer<typeof CheckinRequestSchema>;
export type CheckinSuccess = z.infer<typeof CheckinSuccessSchema>;
export type CheckinError = z.infer<typeof CheckinErrorSchema>;
export type CheckinErrorResponse = z.infer<typeof CheckinErrorResponseSchema>;


export const RewardsRequestSchema = NoRequestSchema;
export const RewardsSuccessSchema = z.object({
  rewards: z.array(RewardSchema),
}).strict();
export const RewardsErrorSchema = z.union([
  UnauthorizedErrorSchema, InternalErrorSchema,
]);
export const RewardsErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, InternalErrorResponseSchema,
]);

export type RewardsRequest = z.infer<typeof RewardsRequestSchema>;
export type RewardsSuccess = z.infer<typeof RewardsSuccessSchema>;
export type RewardsError = z.infer<typeof RewardsErrorSchema>;
export type RewardsErrorResponse = z.infer<typeof RewardsErrorResponseSchema>;


export const RedeemRequestSchema = z.object({ reward_id: UuidSchema }).strict();
export const RedeemSuccessSchema = z.object({
  promo_code: TextSchema.optional(),
  pro_until: TimestampSchema.optional(),
  balance: CoinsSchema,
}).strict().refine(
  (value) => (value.promo_code === undefined) !== (value.pro_until === undefined),
  { message: "Exactly one reward result must be present." },
);
export const RedeemErrorSchema = z.union([
  RewardNotFoundErrorSchema, RewardInactiveErrorSchema,
  UnauthorizedErrorSchema, InsufficientCoinsErrorSchema, ValidationErrorSchema,
  InternalErrorSchema,
]);
export const RedeemErrorResponseSchema = z.union([
  RewardNotFoundResponseSchema, RewardInactiveResponseSchema,
  UnauthorizedResponseSchema, InsufficientCoinsResponseSchema, ValidationResponseSchema,
  InternalErrorResponseSchema,
]);

export type RedeemRequest = z.infer<typeof RedeemRequestSchema>;
export type RedeemSuccess = z.infer<typeof RedeemSuccessSchema>;
export type RedeemError = z.infer<typeof RedeemErrorSchema>;
export type RedeemErrorResponse = z.infer<typeof RedeemErrorResponseSchema>;


export const SubscribeRequestSchema = z.object({
  plan: z.literal("pro_monthly"),
}).strict();
export const SubscribeSuccessSchema = z.object({
  is_pro: z.literal(true),
  pro_until: TimestampSchema,
}).strict();
export const SubscribeErrorSchema = z.union([
  UnauthorizedErrorSchema, ValidationErrorSchema,
  InternalErrorSchema,
]);
export const SubscribeErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ValidationResponseSchema,
  InternalErrorResponseSchema,
]);

export type SubscribeRequest = z.infer<typeof SubscribeRequestSchema>;
export type SubscribeSuccess = z.infer<typeof SubscribeSuccessSchema>;
export type SubscribeError = z.infer<typeof SubscribeErrorSchema>;
export type SubscribeErrorResponse = z.infer<typeof SubscribeErrorResponseSchema>;


export const NutritionMacrosSchema = z.object({
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
}).strict();
export const NutritionItemSchema = NutritionMacrosSchema.extend({
  name: TextSchema,
  grams_estimate: z.number().nonnegative(),
}).strict();
export const NutritionRequestSchema = z.object({
  image: z.instanceof(File),
}).strict();
export const NutritionSuccessSchema = z.object({
  items: z.array(NutritionItemSchema),
  totals: NutritionMacrosSchema,
  confidence: z.enum(["low", "medium", "high"]),
  disclaimer: TextSchema,
}).strict();
export const NutritionErrorSchema = z.union([
  UnauthorizedErrorSchema, ProRequiredErrorSchema,
  ValidationErrorSchema, RateLimitedErrorSchema,
  AiUnavailableErrorSchema,
  InternalErrorSchema,
]);
export const NutritionErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ProRequiredResponseSchema,
  ValidationResponseSchema, RateLimitedResponseSchema,
  AiUnavailableResponseSchema,
  InternalErrorResponseSchema,
]);

export type NutritionRequest = z.infer<typeof NutritionRequestSchema>;
export type NutritionSuccess = z.infer<typeof NutritionSuccessSchema>;
export type NutritionError = z.infer<typeof NutritionErrorSchema>;
export type NutritionErrorResponse = z.infer<typeof NutritionErrorResponseSchema>;


export const PartnerStatsRequestSchema = z.object({
  query: z.object({ partner_id: UuidSchema }).strict(),
}).strict();
export const PartnerStatsSuccessSchema = z.object({
  sales_count: CountSchema,
  revenue_cents: CountSchema,
  commission_cents: CountSchema,
}).strict();
export const PartnerStatsErrorSchema = z.union([
  PartnerNotFoundErrorSchema,
  UnauthorizedErrorSchema, ValidationErrorSchema,
  InternalErrorSchema,
]);
export const PartnerStatsErrorResponseSchema = z.union([
  PartnerNotFoundResponseSchema,
  UnauthorizedResponseSchema, ValidationResponseSchema,
  InternalErrorResponseSchema,
]);

export type PartnerStatsRequest = z.infer<typeof PartnerStatsRequestSchema>;
export type PartnerStatsSuccess = z.infer<typeof PartnerStatsSuccessSchema>;
export type PartnerStatsError = z.infer<typeof PartnerStatsErrorSchema>;
export type PartnerStatsErrorResponse = z.infer<typeof PartnerStatsErrorResponseSchema>;


export const SimulatePurchaseRequestSchema = z.object({ redemption_id: UuidSchema }).strict();
export const SimulatePurchaseSuccessSchema = z.object({
  sale_id: UuidSchema,
  amount_cents: CountSchema,
  commission_cents: CountSchema,
}).strict();
export const SimulatePurchaseErrorSchema = z.union([
  UnauthorizedErrorSchema, ValidationErrorSchema, RedemptionNotFoundErrorSchema,
  AlreadyPurchasedErrorSchema, InternalErrorSchema,
]);
export const SimulatePurchaseErrorResponseSchema = z.union([
  UnauthorizedResponseSchema, ValidationResponseSchema, RedemptionNotFoundResponseSchema,
  AlreadyPurchasedResponseSchema, InternalErrorResponseSchema,
]);
export type SimulatePurchaseRequest = z.infer<typeof SimulatePurchaseRequestSchema>;
export type SimulatePurchaseSuccess = z.infer<typeof SimulatePurchaseSuccessSchema>;
export type SimulatePurchaseError = z.infer<typeof SimulatePurchaseErrorSchema>;
export type SimulatePurchaseErrorResponse = z.infer<typeof SimulatePurchaseErrorResponseSchema>;


export const EndpointContracts = {
  simulatePurchase: {
    method: "POST", path: "/api/partner/simulate-purchase", success_status: 200,
    request: SimulatePurchaseRequestSchema, success: SimulatePurchaseSuccessSchema,
    error: SimulatePurchaseErrorResponseSchema,
  },
  me: {
    method: "GET", path: "/api/me", success_status: 200,
    request: MeRequestSchema, success: MeSuccessSchema, error: MeErrorResponseSchema,
  },
  onboarding: {
    method: "POST", path: "/api/onboarding", success_status: 200,
    request: OnboardingRequestSchema, success: OnboardingSuccessSchema,
    error: OnboardingErrorResponseSchema,
  },
  generatePlan: {
    method: "POST", path: "/api/plan/generate", success_status: 200,
    request: GeneratePlanRequestSchema, success: GeneratePlanSuccessSchema,
    error: GeneratePlanErrorResponseSchema,
  },
  activePlan: {
    method: "GET", path: "/api/plan/active", success_status: 200,
    request: ActivePlanRequestSchema, success: ActivePlanSuccessSchema,
    error: ActivePlanErrorResponseSchema,
  },
  sessions: {
    method: "POST", path: "/api/sessions", success_status: 200,
    request: SessionsRequestSchema, success: SessionsSuccessSchema,
    error: SessionsErrorResponseSchema,
  },
  gyms: {
    method: "GET", path: "/api/gyms", success_status: 200,
    request: GymsRequestSchema, success: GymsSuccessSchema, error: GymsErrorResponseSchema,
  },
  gymQrToken: {
    method: "GET", path: "/api/gyms/:id/qr-token", success_status: 200,
    request: GymQrTokenRequestSchema, success: GymQrTokenSuccessSchema,
    error: GymQrTokenErrorResponseSchema,
  },
  checkin: {
    method: "POST", path: "/api/checkin", success_status: 200,
    request: CheckinRequestSchema, success: CheckinSuccessSchema,
    error: CheckinErrorResponseSchema,
  },
  rewards: {
    method: "GET", path: "/api/rewards", success_status: 200,
    request: RewardsRequestSchema, success: RewardsSuccessSchema,
    error: RewardsErrorResponseSchema,
  },
  redeem: {
    method: "POST", path: "/api/rewards/redeem", success_status: 200,
    request: RedeemRequestSchema, success: RedeemSuccessSchema,
    error: RedeemErrorResponseSchema,
  },
  subscribe: {
    method: "POST", path: "/api/billing/subscribe", success_status: 200,
    request: SubscribeRequestSchema, success: SubscribeSuccessSchema,
    error: SubscribeErrorResponseSchema,
  },
  nutrition: {
    method: "POST", path: "/api/nutrition/analyze", success_status: 200,
    request: NutritionRequestSchema, success: NutritionSuccessSchema,
    error: NutritionErrorResponseSchema,
  },
  partnerStats: {
    method: "GET", path: "/api/partner/stats", success_status: 200,
    request: PartnerStatsRequestSchema, success: PartnerStatsSuccessSchema,
    error: PartnerStatsErrorResponseSchema,
  },
} as const;
export type EndpointName = keyof typeof EndpointContracts;
