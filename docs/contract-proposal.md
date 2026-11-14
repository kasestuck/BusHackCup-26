# Предложение контракта API ShowUp

Актуализация commerce: добавлены 422 invalid_qr_token, 404 reward_not_found, 409 reward_inactive, 404 redemption_not_found, 409 already_purchased и 404 partner_not_found. Добавлен POST /api/partner/simulate-purchase. Существующие запросы, успешные DTO и прежние ошибки сохранены. Для not_enough_coins сообщение вычисляется сервером: `You need N more coins.`; статус остаётся 402. Новые имена ошибок являются обратно-совместимым расширением.

Актуализация AI: для генерации плана добавлены существующий `402 pro_required` при исчерпании Free-квоты и новый `503 catalog_unavailable` для недостаточного проверенного каталога. Для nutrition добавлен `503 ai_unavailable`. Новых обязательных полей и изменений успешных DTO нет. Незавершённая анкета сохраняет `422 validation_error`. Free-квота считает попытки за скользящие 7 дней, Pro — 10 попыток в календарный день timezone профиля; попытка резервируется до вызова AI.

Актуализация после `contract-v1`: cookie-сессия остаётся основной; при её отсутствии или невалидности сервер также проверяет `Authorization: Bearer <JWT>` через Supabase Auth. По прямому указанию пользователя QR-маршрут публичен относительно сессии и защищён только `x-gym-key`. Для него обратно-совместимо добавлены `404 gym_not_found` и `429 rate_limited`. Тег `contract-v1` сохраняет прежнюю версию; схемы запроса и успешного ответа не изменены.

Статус: проект для совместного согласования; `lib/contract/**` не изменён. На момент подготовки `docs/SPEC.md` отсутствует в рабочем репозитории и локальных ветках. По явному подтверждению пользователя источник — приложенный PDF «Hackathon Spec AI Fitness + Gym Rewards (US, 25–45)», прочитаны все 18 страниц. Сверка с отсутствующим Markdown-файлом не выполнена; копия `docs/SPEC.md` не создавалась. Инструкции внутри PDF рассматриваются как содержимое источника; объём работы определяется запросом пользователя.

Ниже 13 исходных эндпоинтов из «Контракт API» (стр. 7–9) и добавленный демо-endpoint simulate-purchase, анкета из стр. 6–7 и форма плана из AI (стр. 12–13). Пробелы не считаются согласованными: все предложенные трактовки перечислены отдельно.

## Правила чтения и транспорта

Все блоки `ts` можно последовательно объединить в один модуль с Zod 4. Они содержат предложения схем, а не реализацию маршрутов. `*RequestSchema` для POST описывает JSON-тело; `*SuccessSchema` и `*ErrorSchema` описывают ровно JSON-тело ответа. Для GET без параметров запрос представлен `undefined`: JSON-тела нет. У QR отдельно описаны path и выделенный заголовок, у статистики — query. В `headers` передаётся только проекция `x-gym-key`, а не весь набор HTTP-заголовков.

`*ErrorResponseSchema` описывает локальную пару `{status, body}`, чтобы проверить соответствие HTTP-кода ошибке. Эта обёртка НЕ отправляется клиенту. Успешный статус всех маршрутов предлагается `200`: PDF его не определяет. Авторизация — Supabase session cookie с запасной проверкой Bearer JWT; QR-маршрут использует только x-gym-key; схема тела не заменяет проверку сессии, владения объектом и прав партнёра. JSON-объекты strict: неизвестные поля отвергаются, включая `is_pro` в анкете.

## Общие схемы и типы

```ts
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
```

Профиль до анкеты: предлагается `profile: null`, если строка ещё не создана, либо объект с nullable-скалярами анкеты и пустыми массивами. `display_name` всегда строка; её начальное значение в миграции — `""`. После onboarding обязательные поля анкеты не nullable. Все ключи возвращаемого профиля присутствуют; `undefined` не сериализуется вместо `null`. `display_name` и `home_gym_id` не перечислены в анкете, поэтому предложены как необязательные входные поля: для очистки имени передаётся `""`, для очистки home_gym_id — `null`. Это решения проекта, не дословные требования PDF.

В API зал содержит только четыре поля из таблицы эндпоинтов: `qr_secret`, `partner_id` и добавленный `timezone` не раскрываются этим DTO. Для `rewards:[…]` предлагаются все поля таблицы `rewards`, поскольку их состав в разделе API не раскрыт. Согласованное с данной миграцией дополнительное ограничение: у pro_month partner_id/discount_pct равны null, у partner_product оба обязательны и скидка строго больше 0, не больше 100. Это намеренное проектное решение, а не явно заданная в PDF discriminated union.

## Форма плана из раздела AI

Сохранены точные имена и вложенность: `duration_min`, строковое `reps`, `rest_sec`, `video.youtube_id`, `video.title`, `safety_note`. Никаких `video_url`, `day_index`, `created_at` или `active` в API-план не добавлено.

```ts
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
```

`AiPlanSchema` буквально следует фразе «то же без name и video», поэтому содержит `id`; происхождение этого UUID в PDF не определено и требует решения. Предложение для будущей реализации: сервер выдаёт UUID сам и не доверяет идентификатору модели. Не включено в API-изменения автоматически. `planSchemaFor` проверяет связи с анкетой и заранее отфильтрованным каталогом; содержимое видео и корректность фильтра травм проверяются сервером, а не одной схемой.

## Ошибки и HTTP-коды

Тело ошибки всегда `{"error":{"code":"...","message":"..."}}`. Ни `status`, ни массив Zod issues, ни SQL/stack trace в JSON не добавляются. Имена `not_enough_coins`, `pro_required`, `already_checked_in` заданы PDF; остальные имена ниже предложены, поскольку PDF определяет только HTTP-семантику.

| HTTP | Код тела | Основание |
| --- | --- | --- |
| 401 | `unauthorized` | Нет действующей Supabase session |
| 401 | `invalid_gym_key` | Предложение для неверного ключа экрана зала |
| 402 | `not_enough_coins` | Баланс меньше стоимости награды |
| 402 | `pro_required` | Анализ питания недоступен без Pro |
| 404 | `plan_not_found` | Нет активного плана; статус прямо указан в API |
| 404 | `reward_not_found` | Неизвестная награда |
| 404 | `redemption_not_found` | Неизвестное или чужое погашение награды |
| 404 | `partner_not_found` | Неизвестный партнёр |
| 409 | `already_checked_in` | Отметка в эту локальную дату уже существует |
| 409 | `reward_inactive` | Награда отключена |
| 409 | `already_purchased` | По погашению уже записана покупка |
| 422 | `validation_error` | Неверный формат или недопустимые входные данные |
| 422 | `invalid_qr_token` | QR-токен неверен или просрочен |
| 429 | `rate_limited` | Лимит AI; для checkin также предложен по стр. 11 |
| 500 | `internal_error` | Явно согласованная безопасная ошибка для всех 14 маршрутов |

```ts
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
```

### Явно согласованное дополнение: HTTP 500

Пользователь явно одобрил добавление `500 internal_error` для всех 13 эндпоинтов. Тело строго `{"error":{"code":"internal_error","message":"An unexpected error occurred."}}`; текст сообщения фиксирован схемой. SQL, stack trace, URL, токены и другие внутренние сведения в ответ не попадают. Это единственное дополнение на этом этапе; остальные схемы запросов, успешных ответов и прежних ошибок не изменены. Общий `lib/contract` не меняется: исполняемая копия блоков находится в `lib/contract-draft/index.ts`, сервер импортирует её через `lib/server/contract.ts`.

## 1. GET /api/me

```ts
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
```

Успех: 200. `is_pro` на верхнем уровне и в профиле должны отражать одно текущее состояние подписки. Алгоритм срока Pro и streak ещё не задан.

## 2. POST /api/onboarding

```ts
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
```

Успех: 200. Рост и вес уже в метрических единицах. `id`, `is_pro` и баланс не являются входными полями. Проверка существования `home_gym_id` выполняется сервером.

## 3. POST /api/plan/generate

```ts
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
```

Успех: 200. Запрос ровно `{}`: сервер берёт анкету из профиля. Предлагается 422 при незаполненной анкете. Сбой AI после повтора по PDF ведёт к проверенному запасному плану с тем же ответом, без добавления `is_fallback`.

## 4. GET /api/plan/active

```ts
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
```

Успех: 200. Отсутствие плана — 404 с общей формой ошибки; `{plan: null}` не является успешным ответом.

## 5. POST /api/sessions

```ts
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
```

Успех: 200. `day_index` предлагается индексом массива `plan.days` от 0; это не номер `weekday`. Сервер проверяет `day_index < plan.days.length`, владельца плана и состав упражнений. Повторная тренировка не получает 409 автоматически: PDF задаёт 409 только для checkin; поведение повторов и размер XP требуют согласования. Для упражнений с собственным весом предлагается `weight_kg: 0`.

## 6. GET /api/gyms

```ts
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
```

Успех: 200, в том числе пустой список. Публичность этого маршрута не обозначена; до согласования предлагается требовать сессию.

## 7. GET /api/gyms/:id/qr-token

```ts
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
```

Успех: 200. В PDF путь и заголовок перенесены между строками: `qr-\ntoken` и `x-\ngym-key`. Чтение как `qrtoken` / `xgym-key` не подтверждено PDF. До сверки с `docs/SPEC.md` предлагаются `qr-token` и `x-gym-key`. Сессионное правило для экрана зала противоречиво: заголовок задан, но исключение из сессий явно не отмечено. По актуальному прямому указанию пользователя сессия не требуется: только ключ. Неизвестный зал возвращает 404 gym_not_found, превышение лимита — 429 rate_limited. `expires_in` предлагается числом секунд до следующей ротации (1–60); точный смысл в PDF не определён, поэтому верхний предел в схеме не навязан.

## 8. POST /api/checkin

```ts
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
```

Успех: 200. 409 `already_checked_in` должен следовать ограничению БД `unique(user_id, local_date)`, включая конкурирующие запросы. Предлагается 422 для неизвестного зала и недействительного/просроченного токена; PDF не задаёт отдельные коды. По актуальному заданию используется HMAC-SHA256(secret, String(floor(unix_time / 60))) в hex; принимаются текущее и предыдущее окна. Дата отметки определяется timezone зала.

## 9. GET /api/rewards

```ts
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
```

Успех: 200. Предлагается показывать только активные награды, сохранив `active` в DTO таблицы. Публичность, сортировка и пагинация не определены.

## 10. POST /api/rewards/redeem

```ts
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
```

Успех: 200. Для `partner_product` предлагается ровно `promo_code`, для `pro_month` — ровно `pro_until`; отсутствующее поле опускается, не равно `null`. PDF обозначает оба поля необязательными без XOR — ограничение выше является предложением. Неизвестная или неактивная награда предлагается как 422. Повтор того же `reward_id` пока не равен повтору запроса: ключ идемпотентности в контракте отсутствует.

## 11. POST /api/billing/subscribe

```ts
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
```

Успех: 200. Успешная активация означает `is_pro: true`; карта и платёжные реквизиты не входят в запрос. Функция оплаты имитируется по PDF, но этот документ маршрута не реализует.

## 12. POST /api/nutrition/analyze

Этот запрос — исключение из фразы «все эндпоинты с JSON»: `multipart/form-data`, поле `image`. Схема применяется к объекту после извлечения единственного файла из FormData; она не описывает JSON-кодирование файла. Проверка повторяющихся полей, magic bytes и декодирования изображения относится к серверу.

```ts
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

```

Успех: 200. По явному запросу пользователя `confidence` и `disclaimer` теперь обязательны в основном ответе `{items, totals, confidence, disclaimer}`; это изменение относительно таблицы API и соответствует разделу AI. Отдельная предварительная схема расширения удалена. Поля `totals` предлагаются как сумма четырёх нутриентов, без `grams_estimate`: состав totals в PDF не перечислен. Лимиты размера/MIME/разрешения не заданы, поэтому не выдуманы в обязательной схеме. `File` требует Web File API (например, Node 22 и DOM-типы TypeScript).

## 13. GET /api/partner/stats?partner_id=

```ts
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
```

Успех: 200. `partner_id` — query, тела нет. Суммы в целых центах USD. Нельзя считать знание partner UUID разрешением читать статистику. Владение/роль партнёра отсутствуют в модели; до их согласования реализация этого маршрута должна оставаться закрытой. Схемы 401/422 не решают этот пробел; возможный 403 требует отдельного добавления к контракту.

## 14. POST /api/partner/simulate-purchase

Авторизованный демо-запрос. Сумму корзины и комиссию определяет сервер; чужой redemption скрывается ответом 404. Повторная покупка по тому же redemption даёт 409.

```ts
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
```

## Реестр 14 маршрутов

```ts
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
```

## Несостыковки и пробелы источника

Ниже перечислены найденные проблемы полного PDF, включая вопросы вне текущей реализации. Отсутствующий `docs/SPEC.md` может содержать другие формулировки.

1. **Источник отсутствует.** Проверить строгое соответствие `docs/SPEC.md` невозможно. Использован приложенный PDF, без автоматического создания Markdown-копии или изменения общих правил.
2. **QR-путь и заголовок.** В PDF стр. 8/14 — `qr-token`; на стр. 8 — `x-gym-key`. `qrtoken` и `xgym-key` из примеров пользователя в PDF не обнаружены; переносы строки могли породить расхождение. Варианты нужно сверить с будущим SPEC, не поддерживать оба молча.
3. **Публичные маршруты.** Стр. 7 говорит об исключении для публичных эндпоинтов, но ни один из 13 не помечен публичным. Экран зала имеет отдельный ключ, но нет явного исключения из Supabase session.
4. **Доступ партнёра.** `partners` и `partner_sales` не имеют связи с auth user / членства / администратора; `partner_id` из query недостаточен для авторизации. У `partner_sales` нет `user_id`: понятие «своей строки» потребует связи через `redemption_id` либо исключительно серверного доступа, причём покупатель и владелец партнёра — разные субъекты. Статус 403 не перечислен.
5. **RLS.** PDF разрешает владельцу читать и писать свои строки (стр. 5), а текущий запрос пользователя требует исключительно SELECT; в работе приоритет имеет более строгое текущее требование.
6. **Анкета и модель.** `profiles.equipment` и `profiles.age` есть в анкете, но отсутствуют в таблице profiles (стр. 5–7). Их добавление прямо запрошено пользователем.
7. **Часовые пояса.** `gym_checkins.local_date` есть, но `gyms.timezone` отсутствует. Пользователь явно запросил эту колонку. Не определены timezone домашней тренировки, смена зала/пояса, граница недели и путешествия между поясами. Уникальность по local_date не означает скользящий лимит 24 часа.
8. **Pro.** `pro_until` используется API и бизнес-логикой, но ни в одной таблице нет такого поля; существует `subscriptions.current_period_end`. Не определены истечение `profiles.is_pro`, источник истины, периодический пересчёт и допустимые `subscriptions.plan/source/status`. Для redeem сказано «продлевается на 30 дней», для subscribe — «now + 30 дней»: поведение при активном Pro различается.
9. **Профиль до onboarding.** Не определены создание строки profiles, nullable-поля, поведение /me без профиля, обязательность `display_name/home_gym_id`, частичное сохранение анкеты и значение `is_pro` при отсутствующем профиле.
10. **Форма анкетных значений.** Не заданы разумные границы роста/веса, нормализация `injuries.when`, пустые и повторяющиеся выборы, комбинация `none` с оборудованием, соответствие `full_gym` конкретному оборудованию exercises. Возраст ограничен 18–70, хотя маркетинговая аудитория 25–45 — это разные ограничения.
11. **Травмы.** `lower back` содержит пробел; кодировка `contraindicated_for` и словарь `muscle_group` не определены. `other` не содержит свободного описания. В промпте используется отсутствующее `user.level`.
12. **Типы таблиц.** Для большинства id не указаны SQL-типы/UUID, для денежных и числовых полей — диапазоны, для JSON — структура и обязательность. FK, on-delete правила и индексы кроме checkin не описаны. `exercises.equipment` не имеет указанной скалярности. `subscriptions` не имеет id/явного PK/истории.
13. **План модели и серверный UUID.** Формулировка «то же без name/video» оставляет модели `id`; серверное создание UUID не описано. Неясно, хранит plan_json полную API-форму или только slug-форму, как синхронизируется его id с workout_plans.id.
14. **Активный план.** Не определено ограничение одного active-плана на пользователя, поведение конкурентных генераций, деактивация старого плана, доступ к старым планам и дата начала недельного календаря.
15. **Валидация AI.** Промпт задаёт количество упражнений по длительности, но JSON-схема и пограничные значения sets/reps/rest отсутствуют. Удаление неизвестного slug может нарушить число упражнений/длительность. Неизвестного slug нет в каталоге, а AI не возвращает muscle_group: откуда сервер узнаёт «ту же мышечную группу» для замены, не определено. Замена должна повторно соблюдать травмы и оборудование. Нет правила для пустого безопасного каталога и непригодного fallback.
16. **Журнал.** `day_index` не определён как 0-based/1-based и не сопоставлен с `weekday`. `reps` в плане строка, в журнале тип не указан; нет модели длительности для планки/кардио, пропущенных/изменённых упражнений и частично выполненных подходов. Структура `log_json` не определена.
17. **XP.** Есть `workout_sessions.xp` и `xp_earned`, но нет формулы, размера начисления, суммарного XP или уровня пользователя.
18. **Streak.** Есть ответы `streak`, но нет единицы измерения, источника событий, правила выходных/пропусков, начала/сброса и timezone.
19. **Дневные/недельные награды.** Для тренировочных 10 coins нет local_date в sessions и нет определения календарного дня. «Не больше одной в день» находится в таблице начисления коинов; это ограничение награды, а не явный запрет сохранять дополнительные сессии. Для недельных 50 coins неясно, нужны checkin или сессии, когда неделя завершена, какой snapshot weekdays брать и что делать при изменении анкеты. В примере «13 визитов × 50» предполагаются 40 за checkin плюс 10 за журнал; автоматическое объединение этих действий не описано.
20. **Идемпотентность.** Нет словаря `coin_ledger.reason`, типа/семантики `ref_id` и поведения повторов generate/sessions/redeem/subscribe. Уникальность (user_id, reason, ref_id) сама по себе не обеспечивает награду за первый план один раз, если ref_id меняется при каждой генерации, и не ограничивает разные session IDs одним днём. Нет Idempotency-Key в HTTP.
21. **Баланс и транзакции.** Не описаны механизм сериализации списаний, RPC-сигнатура и SQL→HTTP маппинг. Повтор redeem после потери ответа может означать новую покупку. Возврат/отмена награды и корректировки ledger не заданы.
22. **Награды.** `rewards:[…]` не раскрыт. Не определены nullable partner_id/discount_pct по kind, только active или все, сортировка, пагинация. `promo_code?` и `pro_until?` не задают XOR/nullability, формат промокода, срок действия, единственность использования или учёт истечения.
23. **Продажи партнёра.** Кнопка «Use code at partner store» должна писать partner_sales (стр. 10), но среди 13 маршрутов нет endpoint для её действия. Нет стоимости товара/суммы покупки в rewards, курса coins→USD, источника amount_cents, правила округления комиссии и запрета повторного использования промокода. Сам redeem не доказывает продажу.
24. **Имитация.** Стр. 16 говорит, что имитируется только оплата, однако стр. 10 прямо имитирует также покупку у партнёра. Это нужно честно согласовать для отчёта и демо.
25. **QR.** Для HMAC не определены сериализация номера окна, кодировка результата (hex/base64url), формат URL/ручного кода, длина/ротация qr_secret, смысл expires_in и момент проверки. Принятие предыдущего окна означает, что токен может приниматься после показанного срока ротации. Нет численных лимитов checkin.
26. **Лимиты AI.** Таблица Free/Pro (стр. 10) обещает Pro «без лимита», раздел безопасности (стр. 14) — до 10 генераций в день. Не определены календарная/скользящая неделя, timezone, учёт неудачных вызовов/fallback, параллельные запросы и хранилище лимита. Лимит nutrition не задан.
27. **Питание: форма.** Раздел API возвращает только items/totals, раздел AI дополнительно confidence/disclaimer. По новому явному запросу пользователя оба поля включены в основной ответ. Поля totals и правило округления/суммирования не перечислены, ответ на фото без еды не определён.
28. **Питание: загрузка.** Общая фраза «с JSON» конфликтует с multipart. Не определены MIME, размер, число файлов, разрешение, хранение/удаление, bucket и политики Storage для image_path; RLS food_logs не защищает сами объекты Storage.
29. **HTTP.** Успешные статусы, имена ошибок кроме трёх, 404 для других отсутствующих ресурсов, 403, 413/415, 5xx, Retry-After и CSRF-защита cookie POST не заданы. Предложенные 422 для отсутствующих/недоступных ссылок нужно согласовать, не выдавать внутренние SQL-ошибки напрямую.
30. **P2 API.** Перегенерация после изменения анкеты и замена отдельного упражнения упомянуты в scope, но маршрут замены упражнения отсутствует; не добавляется четырнадцатый маршрут.
31. **Внешние зависимости и организационные вопросы.** Доступ/формат Meta Model API, точность model ID и цен, доступность видео/встраивания не подтверждаются самим PDF; в этой задаче интеграции не выполняются. В источнике также открыты трек, три пункта сабмишена, допуск имитации оплаты, выбор видео, домен/торговое имя и реальные условия партнёров.
32. **Ключи Supabase.** Стр. 4 обобщает, что «ключи AI и базы» остаются на сервере, но стр. 17 прямо задаёт `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Необходимо различать публичный anon key, защищённый RLS/привилегиями, и секретный service role key, который остаётся только на сервере.

## Принятые решения и границы SQL-миграции

Этот раздел описывает первоначальную `supabase/migrations/202611140001_initial_schema.sql`, чтобы не смешивать SQL с ещё не согласованным API. Уточнения второй миграции ниже имеют приоритет над историческим описанием первого шага.

1. **Ровно 13 таблиц.** Созданы перечисленные в модели public-таблицы. Единственные дополнительные колонки: `profiles.equipment text[]`, `profiles.age integer`, `gyms.timezone text` — все три прямо запрошены пользователем. `pro_until` отдельной колонкой не добавлен: результат redeem берётся из `subscriptions.current_period_end`. Профиль автоматически при регистрации не создаётся; это задача будущего сервера.
2. **Типы и связи.** ID выбраны UUID; для прикладных id задан `gen_random_uuid()`, для времён событий — `timestamptz default now()`; `profiles.id` ссылается на `auth.users`. Пользовательские дочерние данные ссылаются на profiles с `ON DELETE CASCADE`; каталожные ссылки и связь partner_sales→redemptions по умолчанию запрещают удаление используемых строк. Поэтому при наличии partner_sales удаление связанного профиля требует отдельной политики обработки истории продаж. `subscriptions.user_id` — PK: хранится текущее состояние, не история подписок.
3. **Анкета и каталог.** Профиль допускает незаполненные скаляры и пустые массивы; `display_name` — NOT NULL с `''` по умолчанию, `is_pro` — false. Возраст 18–70, метрики положительные, weekdays 1–7, session_minutes из анкеты. Массивы проверяются на разрешённые значения и отсутствие NULL, но SQL не запрещает дубликаты/пустые выборы или сочетание none с другим оборудованием: более строгая полная проверка выше предложена для onboarding. `injuries` проверяется только как JSON-массив, plan/input/result JSON — как объекты; вложенные поля и log_json должен валидировать будущий сервер. `exercises.equipment` выбран одним текстовым значением из четырёх анкетных вариантов, `contraindicated_for` использует точный словарь областей травмы, включая `lower back`. Проверка YouTube ID/доступности видео на SQL-уровне не реализована.
4. **Timezone и даты.** timezone обязательна без придуманного значения по умолчанию; триггер проверяет её наличие в `pg_catalog.pg_timezone_names`. `unique(user_id, local_date)` защищает от двух checkin на одну дату во всех залах. Вычисление local_date из checked_in_at/timezone и верификация HMAC остаются будущему серверу; SQL не утверждает, что произвольно переданные service role дата и токен достоверны.
5. **Планы и сессии.** Частичный unique-индекс допускает один активный план на пользователя. Составной FK `workout_sessions(plan_id, user_id)` запрещает сослаться на чужой план; `day_index` ограничен 0–6. Проверка существования этого индекса внутри plan_json, принадлежности slug и завершения всех подходов остаётся серверу. Дополнительные сессии за день сохранять разрешено; ежедневность относится к награде. XP неотрицателен, default 0 не является реализованной формулой начисления.
6. **Доступ.** RLS включён на всех 13 таблицах. Anon и PUBLIC не получают табличных прав; authenticated не получает INSERT/UPDATE/DELETE/TRUNCATE. Для восьми таблиц с прямым владельцем разрешён SELECT только своего auth.uid: profiles, workout_plans, workout_sessions, gym_checkins, coin_ledger, redemptions, subscriptions, food_logs. Каталоги exercises/partners/gyms не имеют владельца и читаются авторизованными пользователями; rewards — только active. Для gyms выданы права SELECT лишь на безопасные колонки id/name/city/address/partner_id/timezone; qr_secret недоступен, SELECT * целиком не разрешён. Это SQL-доступ к каталогу, тогда как API DTO gyms остаётся из четырёх полей.
7. **Партнёрские продажи.** Для partner_sales нет клиентского SELECT и нет RLS-политики: доступ оставлен сервису до согласования владения партнёром. Комиссия и сумма хранятся в целых неотрицательных центах, commission_cents не выше amount_cents. Не добавлены уникальность использования redemption, проверка совпадения партнёра с наградой и формула/округление комиссии: бизнес-сценарий продажи пока не определён. Redeem сам partner_sales не создаёт, потому что обмен промокода не доказывает покупку.
8. **Ledger и баланс.** `coin_balance(uuid)` — SECURITY INVOKER SQL-функция `coalesce(sum(amount), 0)::bigint`; колонка баланса нигде не хранится. Для authenticated применяется RLS: запрос баланса другого пользователя даёт 0, не его сумму. service_role видит выбранного пользователя. Функция не выдана anon/PUBLIC. Значение bigint нужно безопасно преобразовывать в JSON safe integer будущим API; переполнение безопасного диапазона JS не замалчивается схемой.
9. **Идемпотентность наград.** `ref_id` выбран text для UUID/даты/начала недели. Частичный unique `(user_id, reason, ref_id) WHERE ref_id IS NOT NULL` покрывает все события с ключом. Для first_plan/workout_session/gym_checkin/weekly_bonus/reward_redemption ref_id обязателен; четыре награды должны быть положительными, reward_redemption — отрицательной. Отдельный unique `(user_id, reason) WHERE reason = 'first_plan'` запрещает повторную lifetime-награду даже при новом plan UUID. Предлагаемые ключи сервера: first_plan — UUID первого плана; workout_session — локальная дата награды; gym_checkin — checkin UUID при существующем дневном unique; weekly_bonus — начало соответствующей недели; reward_redemption — UUID redemption. Выбор timezone и начала недели пока открыт. Индекс не заменяет этот алгоритм ключей: произвольные различные ref_id дадут разные награды. Для иных reason nullable ref_id разрешён; словарь reason не закрыт SQL enum.
10. **Изменения ledger.** Service role получает лишь SELECT/INSERT, без прямого UPDATE/DELETE; исправления предполагаются компенсирующими событиями. Это ограничение прямых прикладных операций: владелец БД остаётся привилегированным, а удаление профиля может каскадно удалять его данные. Изменения остальных таблиц доступны service_role; клиент не может поменять is_pro или вставить ledger.
11. **Atomic redeem.** `redeem_reward(p_user_id uuid, p_reward_id uuid)` — SECURITY INVOKER, результат jsonb, EXECUTE только service_role, фиксированный пустой search_path. Сначала проверяется READ COMMITTED, затем блокируется profiles-строка пользователя FOR UPDATE, активная награда читается FOR SHARE, затем считается баланс. Отрицательная ledger-строка и redemption, а для Pro также подписка и is_pro, выполняются в одной транзакции; ошибка откатывает все эти изменения. Параллельные вызовы этой функции для одного пользователя сериализуются по той же строке. Другие уровни изоляции явно отвергаются, чтобы после ожидания не читать устаревший snapshot. Гарантия отсутствия перерасхода относится к этому RPC: доверенный сервис всё ещё может напрямую вставить отрицательную ledger-строку. Каждый будущий путь списания обязан брать ту же блокировку и проверять баланс; всеобщего триггера на произвольные списания нет.
12. **Результат награды.** Pro-награда имеет NULL partner_id/discount_pct; partner_product требует оба поля, скидку >0 и ≤100. Стоимость строго положительная. Для промокода генерируется `SHOWUP-` плюс случайный UUID без дефисов в верхнем регистре; unique promo_code предотвращает дубликаты, но использование/истечение промокода не реализованы. Для Pro период — `greatest(current_period_end, statement_timestamp()) + interval '30 days'`, либо now+30 при отсутствии подписки; записываются plan=pro_monthly, source=coins, status=active, is_pro=true. Эти строковые значения выбраны для RPC, остальные значения subscriptions SQL намеренно не закрывает enum. Автоматическое выключение is_pro при истечении срока и billing/subscribe пока не реализованы; будущая проверка Pro должна учитывать current_period_end/status.
13. **Ошибки SQL.** Доменные исключения имеют SQLSTATE P0001, машинный код в MESSAGE и английский DETAIL: unsupported_isolation_level, invalid_request, profile_not_found, reward_not_found, not_enough_coins. Это внутренний SQL-интерфейс, а не новое тело HTTP: будущий route должен безопасно преобразовать недостаток средств в 402 not_enough_coins, остальные ожидаемые ошибки — по согласованному API. Нельзя отдавать сырой текст SQL-ошибки или утверждать, что HTTP-маппинг уже работает.
14. **Границы поставки.** Нет API-роутов, seed, AI-вызовов, начисления первых/дневных/недельных наград, billing, QR-проверки, rate limit, вычисления streak/XP, Storage-политик, автоматического истечения Pro и регистрации профиля. Тестовые временные строки нужны только для проверки SQL и не являются seed. Никакое утверждение этого раздела не означает готовый путь браузер→Supabase Auth→Next.js API.

## Предложенные решения, ещё не общий контракт

### Изменения второго этапа по запросу пользователя

- Добавлена отдельная миграция `supabase/migrations/202611140002_profile_bootstrap_and_permissions.sql`; первая миграция не редактируется. `profiles.timezone` — NOT NULL text с default `America/New_York`, проверяется по `pg_timezone_names`. Поле включено в Profile DTO; в onboarding оно необязательно, отсутствие сохраняет серверное значение. Схема Intl проверяет поддерживаемый runtime timezone, БД повторно проверяет имя по своему каталогу. Границы дня/недели ещё предстоит использовать в бизнес-логике.
- `create_profiles_for_auth_users()` — SECURITY DEFINER с пустым search_path; создаёт профили только по auth user id, не копирует привилегированные поля из user metadata. Собственный AFTER INSERT statement trigger добавляется при отсутствии триггера с тем же именем. Transition table поддерживает bulk insert; ON CONFLICT сохраняет существующий профиль. Statement trigger запускается после имеющихся row triggers, поэтому не мешает типичному уже настроенному созданию профиля. Чужие auth-триггеры не удаляются и не переписываются. Отсутствующие профили ранее зарегистрированных пользователей также создаются миграцией.
- После явного REVOKE всех табличных и колоночных прав в public authenticated получает SELECT только восьми пользовательских таблиц, ограниченный прежними own-row RLS-политиками. Прямой клиентский доступ к gyms/exercises/rewards/partners/partner_sales закрыт; каталоги будущий сервер выдаёт через `/api/**`. Это намеренное ужесточение относительно первого этапа. Удалены прежние SELECT-политики каталогов. Anon не получает SELECT.
- Новая SECURITY DEFINER функция имеет пустой search_path. Остальные существующие SECURITY DEFINER функции в public получают фиксированный `pg_catalog, public, pg_temp`: это сохраняет обычные ссылки вида `INSERT INTO profiles`, при этом временная схема ищется последней. CREATE в public отзывается у PUBLIC/anon/authenticated, чтобы клиент не мог подменить объекты. Необычные старые функции с зависимостями в других схемах должны использовать квалифицированные имена. EXECUTE отзывается у PUBLIC и всех явно перечисленных в ACL ролей, кроме service_role и владельца. Системные функции Supabase в auth/storage и системных схемах не изменяются. PostgreSQL сохраняет права владельца/администратора; речь о прикладных ролях. Роль Auth вызывает триггер при INSERT без прямого RPC-доступа к его функции. Также закрыты default privileges будущих объектов, создаваемых ролью миграции.
- Поля `exercises.video_youtube_id` и `video_title` разрешают NULL. CHECK запрещает verified=true без корректного по форме 11-символьного ID и непустого названия; существование/доступность YouTube не может доказать SQL. В исходном seed все видео отсутствуют и verified=false. Это прямо запрошенное отклонение от первоначального требования готового каталога видео.
- В `NutritionSuccessSchema` теперь обязательны `confidence: low | medium | high` и `disclaimer: string`, как потребовал пользователь. Это изменение предложения контракта, без записи в `lib/contract` и без реализации маршрута.
- Seed создаёт три вымышленных зала в одном городе, три партнёра и три награды 1200/500/900. Стабильные ключи позволяют повторять запуск; существующие QR-секреты и видео, проверенные людьми, сохраняются. Это серия REST-запросов, не единая транзакция: после частичной ошибки нужен повторный запуск. `--dry-run` валидирует определения без подключения к Supabase.
- Проверка видео через oEmbed сообщает техническую доступность embedding на момент запроса; это не проверка техники упражнения, медицинской пригодности или ограничений конкретного пользователя. `contraindicated_for` — предварительные фильтрующие теги каталога, требующие человеческой проверки; они не являются заключением о безопасности тренировки. Валидатор не назначает verified=true автоматически и не выдумывает отсутствующие IDs.
- `scripts/postgrest-smoke.mjs` предназначен для запуска владельцем с тремя переменными окружения Supabase. Он проверяет REST/Auth/RPC, создаёт временные записи и удаляет тестовых пользователей в finally. Его нельзя считать пройденным без реального запуска с ключами. Скрипты этой поставки используют Node built-ins и не зависят от корневого package.json.
- `scripts/verification` не изменяется и не расширяется. Его старый общий runner рассчитан на первую миграцию и прежний nutrition-контракт; он не служит проверкой второго этапа. Существующий `scripts/verification/.gitignore` уже исключает node_modules. На момент этой работы корневого package.json и docs/SPEC.md в рабочей копии по-прежнему нет.

Правила trigger/security definer сверены с [Supabase User Management](https://supabase.com/docs/guides/auth/managing-user-data); отдельный отзыв колоночных прав — с [PostgreSQL REVOKE](https://www.postgresql.org/docs/current/sql-revoke.html).

- Заданы Zod 4, strict-объекты, UUID-строки, ISO 8601 timestamps с timezone, JSON safe integers для счётчиков/коинов/центов, 200 для успешных ответов. Никаких новых endpoint.
- Nullable-профиль и пустые массивы до onboarding; обязательная полная анкета при POST; необязательные display_name/home_gym_id; число 18–70 для age, а не маркетинговые 25–45.
- Непустые уникальные weekdays/workout_types/equipment и отдельное значение none; положительные height_cm/weight_kg; без выдуманных медицинских верхних границ.
- Индекс дня от 0; положительные целочисленные reps/sets, неотрицательный weight_kg; ноль для собственного веса. Это требует сверки с UI кардио/таймеров.
- Ответ плана точно по AI; `duration_min` соответствует выбранному session_minutes; YouTube ID имеет 11 допустимых символов, его существование проверяется отдельно.
- Закрытые сессией маршруты до явного перечня публичных; для QR дополнительно x-gym-key. Для partner stats доступа по одному UUID недостаточно, реализацию необходимо закрыть до определения прав.
- Reward DTO взят из одноимённой таблицы. Для redeem — ровно один из promo_code/pro_until; inactive/unknown reward и недействительный token предварительно трактуются как 422.
- По явному запросу пользователя nutrition расширен обязательными confidence/disclaimer. totals предлагается суммой kcal/protein_g/carbs_g/fat_g.
- 401 unauthorized/invalid_gym_key, 404 plan_not_found, 422 validation_error и 429 rate_limited — предложенные имена; 429 для checkin — предложенный статус из требования rate limit.
- Вопросы XP, streak, partner ownership, лимитов AI, Storage и бизнес-идемпотентности не скрыты за фиктивной реализацией. Этот файл ничего не деплоит, не создаёт API-роуты и не изменяет `lib/contract`.

