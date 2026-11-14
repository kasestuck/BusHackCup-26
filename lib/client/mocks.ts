/**
 * DEVELOPMENT MOCKS — active only when NEXT_PUBLIC_USE_MOCKS=true (SPEC §4).
 *
 * Every response matches a schema in `lib/contract` exactly; the UI shows a
 * "Mock data" badge whenever these are in use so nobody mistakes them for live data.
 * Switch a route off here (or the whole flag) as soon as the backend endpoint works.
 *
 * Scenarios for checking UI states: add `?mock=<scenario>` to any page URL. The choice
 * sticks for the browser tab (sessionStorage) so it survives navigation. Switching scenario
 * starts clean; `?mock=reset` clears everything the mock "saved" (answers, plan, coins).
 */
import type {
  MeResponse,
  OnboardingRequest,
  Plan,
  PlanDay,
  Profile,
  RewardsResponse,
  Weekday,
} from "@/lib/contract";
import {
  API_ROUTES,
  CheckinRequestSchema,
  OnboardingRequestSchema,
  RedeemRequestSchema,
  SessionRequestSchema,
} from "@/lib/contract";

import { ASSISTANT_ROUTE, AssistantRequestSchema } from "./assistant-contract";

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

export const MOCK_SCENARIOS = [
  "default",
  "rest_day",
  "new_user",
  "no_plan",
  "empty_rewards",
  "pro",
  "error",
  "unauthorized",
  "offline",
  "slow",
  "generate_error",
  "rate_limited",
  "rich",
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

const SCENARIO_KEY = "showup.mock.scenario";
const DB_KEY = "showup.mock.db";

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

const isScenario = (v: string | null): v is MockScenario =>
  (MOCK_SCENARIOS as readonly string[]).includes(v ?? "");

export function getMockScenario(): MockScenario {
  if (typeof window === "undefined") return "default";
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("mock");
  const s = storage();
  try {
    // `?mock=reset` wipes the mock's saved state once, then drops itself from the URL
    // so later requests on the same page don't keep wiping it.
    if (fromUrl === "reset") {
      s?.removeItem(SCENARIO_KEY);
      s?.removeItem(DB_KEY);
      params.delete("mock");
      const qs = params.toString();
      window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
      return "default";
    }
    const saved = s?.getItem(SCENARIO_KEY) ?? "default";
    if (isScenario(fromUrl)) {
      // Switching scenario starts from a clean slate; staying on it keeps saved state.
      if (saved !== fromUrl) {
        s?.setItem(SCENARIO_KEY, fromUrl);
        s?.removeItem(DB_KEY);
      }
      return fromUrl;
    }
    return isScenario(saved) ? saved : "default";
  } catch {
    return isScenario(fromUrl) ? fromUrl : "default";
  }
}

/** Used by mock auth: signing in/up/out moves the tab to the matching scenario. */
export function setMockScenario(scenario: MockScenario, opts: { clearData?: boolean } = {}) {
  const s = storage();
  try {
    if (scenario === "default") s?.removeItem(SCENARIO_KEY);
    else s?.setItem(SCENARIO_KEY, scenario);
    if (opts.clearData) s?.removeItem(DB_KEY);
  } catch {
    // Storage blocked: scenario falls back to the URL / default.
  }
}

/** What the mock backend has "stored" for this tab. */
type MockDb = {
  profile?: Profile;
  onboarding?: OnboardingRequest;
  plan?: Plan;
  /** Coins earned in this tab on top of the scenario's starting balance. */
  coinsEarned?: number;
  /** Local date (YYYY-MM-DD) of the last logged session — coins pay once a day (SPEC §7). */
  lastSessionDate?: string;
  /** Local date of the last gym check-in — one per day (SPEC §7). */
  lastCheckinDate?: string;
  /** Coins spent on rewards in this tab. */
  coinsSpent?: number;
  /** ISO end of Pro granted by redeeming "1 month of Pro". */
  proUntil?: string;
};

const localDate = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ---------------------------- Gyms & check-in ---------------------------- */

/** Demo gyms: fictional names in one US city (SPEC §11 "Demo data"). */
const MOCK_GYMS = [
  { id: "mock-gym-01", name: "Forge Athletic Club", city: "Austin, TX", address: "1200 E 6th St" },
  { id: "mock-gym-02", name: "Northline Strength", city: "Austin, TX", address: "4800 Burnet Rd" },
  { id: "mock-gym-03", name: "Riverside Performance", city: "Austin, TX", address: "300 S Lamar Blvd" },
];

/**
 * Stand-in for HMAC_SHA256(qr_secret, floor(unix/60)) — a 6-digit code per gym per minute.
 * Not secure; only shapes and timing match the real endpoint.
 */
function mockToken(gymId: string, window: number): string {
  let h = 2166136261;
  for (const c of `${gymId}:${window}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return String((h >>> 0) % 1_000_000).padStart(6, "0");
}

const minuteWindow = () => Math.floor(Date.now() / 60_000);

function baseStreak(scenario: MockScenario) {
  return scenario === "new_user" ? 0 : 6;
}

function baseBalance(scenario: MockScenario, db: MockDb) {
  if (scenario === "rich") return 1500;
  return scenario === "new_user" ? (db.plan ? 20 : 0) : 640;
}

/** Balance = start + earned − spent, mirroring sum(coin_ledger) on the server. */
function currentBalance(scenario: MockScenario, db: MockDb) {
  return baseBalance(scenario, db) + (db.coinsEarned ?? 0) - (db.coinsSpent ?? 0);
}

function mockIsPro(scenario: MockScenario, db: MockDb) {
  return scenario === "pro" || (!!db.proUntil && new Date(db.proUntil).getTime() > Date.now());
}

const PROMO_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function mockPromoCode(pct: number | null) {
  let tail = "";
  for (let i = 0; i < 6; i++) tail += PROMO_ALPHABET[Math.floor(Math.random() * PROMO_ALPHABET.length)];
  return `SHOWUP${pct ?? ""}-${tail}`;
}

function readDb(): MockDb {
  try {
    return JSON.parse(storage()?.getItem(DB_KEY) ?? "{}") as MockDb;
  } catch {
    return {};
  }
}

function writeDb(db: MockDb) {
  try {
    storage()?.setItem(DB_KEY, JSON.stringify(db));
  } catch {
    // Storage blocked: the mock simply forgets; nothing else depends on it.
  }
}

const isoWeekday = (d: Date): Weekday => (((d.getDay() + 6) % 7) + 1) as Weekday;
const shift = (w: number, by: number): Weekday => ((((w - 1 + by) % 7) + 7) % 7 + 1) as Weekday;

const MOCK_VIDEO = { youtube_id: "mock-video-id", title: "Mock technique video" };

const DAY_TEMPLATES: Omit<PlanDay, "weekday">[] = [
  {
    focus: "Lower body",
    duration_min: 45,
    exercises: [
      { slug: "goblet-squat", name: "Goblet Squat", sets: 3, reps: "8-10", rest_sec: 90, note: "Keep your chest up and knees tracking over toes.", video: MOCK_VIDEO },
      { slug: "romanian-deadlift", name: "Romanian Deadlift", sets: 3, reps: "8-10", rest_sec: 90, note: "Hinge at the hips, soft knees, neutral spine.", video: MOCK_VIDEO },
      { slug: "walking-lunge", name: "Walking Lunge", sets: 3, reps: "10 each leg", rest_sec: 75, note: "Long stride, front knee stays over the ankle.", video: MOCK_VIDEO },
      { slug: "leg-press", name: "Leg Press", sets: 3, reps: "10-12", rest_sec: 90, note: "Lower under control; don't lock out the knees.", video: MOCK_VIDEO },
      { slug: "plank", name: "Plank", sets: 3, reps: "30-45 sec", rest_sec: 45, note: "Squeeze glutes, ribs down, breathe steadily.", video: MOCK_VIDEO },
    ],
  },
  {
    focus: "Upper body push",
    duration_min: 45,
    exercises: [
      { slug: "dumbbell-bench-press", name: "Dumbbell Bench Press", sets: 3, reps: "8-10", rest_sec: 90, note: "Shoulder blades pinned back, elbows ~45°.", video: MOCK_VIDEO },
      { slug: "seated-shoulder-press", name: "Seated Shoulder Press", sets: 3, reps: "8-10", rest_sec: 90, note: "Brace your core; press straight overhead.", video: MOCK_VIDEO },
      { slug: "push-up", name: "Push-Up", sets: 3, reps: "AMRAP", rest_sec: 60, note: "Body in one line from head to heels.", video: MOCK_VIDEO },
      { slug: "cable-triceps-pushdown", name: "Cable Triceps Pushdown", sets: 3, reps: "12", rest_sec: 60, note: "Elbows stay glued to your sides.", video: MOCK_VIDEO },
      { slug: "dead-bug", name: "Dead Bug", sets: 3, reps: "8 each side", rest_sec: 45, note: "Lower back stays pressed into the floor.", video: MOCK_VIDEO },
    ],
  },
  {
    focus: "Upper body pull",
    duration_min: 45,
    exercises: [
      { slug: "lat-pulldown", name: "Lat Pulldown", sets: 3, reps: "10-12", rest_sec: 90, note: "Pull to the upper chest, no swinging.", video: MOCK_VIDEO },
      { slug: "seated-cable-row", name: "Seated Cable Row", sets: 3, reps: "10-12", rest_sec: 90, note: "Lead with the elbows, squeeze shoulder blades.", video: MOCK_VIDEO },
      { slug: "dumbbell-row", name: "One-Arm Dumbbell Row", sets: 3, reps: "10 each arm", rest_sec: 75, note: "Flat back, pull toward the hip.", video: MOCK_VIDEO },
      { slug: "face-pull", name: "Face Pull", sets: 3, reps: "12-15", rest_sec: 60, note: "Pull to eye level, thumbs point back.", video: MOCK_VIDEO },
      { slug: "glute-bridge", name: "Glute Bridge", sets: 3, reps: "12", rest_sec: 45, note: "Pause at the top, ribs down.", video: MOCK_VIDEO },
      { slug: "side-plank", name: "Side Plank", sets: 2, reps: "20-30 sec each", rest_sec: 45, note: "Hips high, stack your shoulders.", video: MOCK_VIDEO },
    ],
  },
];

/** Mock plan built around today so the default scenario always has a session to show. */
function mockPlan(today: Date, restToday: boolean): Plan {
  const base = shift(isoWeekday(today), restToday ? 1 : 0);
  const weekdays = [base, shift(base, 2), shift(base, 4)].sort((a, b) => a - b);
  return {
    id: "mock-plan-0001",
    title: "Strength Foundations",
    summary: "3 days a week, 45 minutes, full gym",
    days: weekdays.map((weekday, i) => ({ weekday, ...DAY_TEMPLATES[i % DAY_TEMPLATES.length] })),
    safety_note: "This plan is general fitness guidance, not medical advice.",
  };
}


const MOCK_REWARDS: RewardsResponse = {
  rewards: [
    { id: "mock-reward-pro", kind: "pro_month", title: "1 month of ShowUp Pro", partner_id: null, cost_coins: 1200, discount_pct: null, active: true },
    { id: "mock-reward-15", kind: "partner_product", title: "15% off sports nutrition", partner_id: "mock-partner-01", cost_coins: 500, discount_pct: 15, active: true },
    { id: "mock-reward-25", kind: "partner_product", title: "25% off sports nutrition", partner_id: "mock-partner-02", cost_coins: 900, discount_pct: 25, active: true },
  ],
};


function mockMe(scenario: MockScenario, plan: Plan, db: MockDb): MeResponse {
  const isPro = mockIsPro(scenario, db);
  const fresh = scenario === "new_user";
  const profile: Profile | null =
    db.profile ??
    (fresh
      ? null
      : {
          id: "mock-user-0001",
          display_name: "Alex",
          height_cm: 178,
          weight_kg: 80,
          goal: "get_stronger",
          workout_types: ["gym_strength"],
          session_minutes: 45,
          weekdays: plan.days.map((d) => d.weekday),
          injuries: [],
          home_gym_id: "mock-gym-01",
          is_pro: isPro,
        });
  return {
    profile,
    // New users earn 20 coins for their first AI plan (SPEC §7).
    coins_balance: currentBalance(scenario, db),
    streak: baseStreak(scenario) + (db.lastCheckinDate === localDate() ? 1 : 0),
    is_pro: isPro,
    has_plan: !!db.plan || (!fresh && scenario !== "no_plan"),
  };
}

const TITLES: Record<OnboardingRequest["goal"], string> = {
  lose_fat: "Lean Engine",
  build_muscle: "Build Phase",
  get_stronger: "Strength Foundations",
  general_fitness: "Everyday Athlete",
  endurance: "Engine Builder",
};

const EQUIPMENT_LABEL: Record<OnboardingRequest["equipment"][number], string> = {
  full_gym: "full gym",
  dumbbells: "dumbbells",
  bands: "bands",
  none: "no equipment",
};

/** Exercises per session from the plan prompt in SPEC §8 (lower bound of each range). */
const EXERCISES_FOR: Record<number, number> = { 20: 3, 30: 4, 45: 5, 60: 6, 75: 7 };

/** Mirrors what the backend returns from POST /api/plan/generate, built from saved answers. */
function mockGeneratedPlan(input: OnboardingRequest): Plan {
  const n = input.weekdays.length;
  const count = EXERCISES_FOR[input.session_minutes] ?? 5;
  const ongoing = input.injuries.some((i) => i.status === "ongoing");
  return {
    id: `mock-plan-${Date.now().toString(36)}`,
    title: TITLES[input.goal],
    summary: `${n} day${n > 1 ? "s" : ""} a week, ${input.session_minutes} minutes, ${input.equipment
      .map((e) => EQUIPMENT_LABEL[e])
      .join(" + ")}`,
    days: input.weekdays.map((weekday, i) => {
      const t = DAY_TEMPLATES[i % DAY_TEMPLATES.length];
      return { weekday, focus: t.focus, duration_min: input.session_minutes, exercises: t.exercises.slice(0, count) };
    }),
    safety_note:
      "This plan is general fitness guidance, not medical advice." +
      (ongoing ? " Because you have an ongoing injury, check with a doctor before you start." : ""),
  };
}

/* ------------------------------ AI Coach --------------------------------- */

const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/**
 * Keyword-based stand-in for the model behind POST /api/assistant (PROPOSAL).
 * Uses the same mock plan, coins and streak the rest of the app shows.
 */
function mockCoachReply(text: string, plan: Plan, balance: number, streak: number): string {
  const t = text.toLowerCase();
  const wd = isoWeekday(new Date());
  const today = plan.days.find((d) => d.weekday === wd);
  const upcoming = [...plan.days].sort((a, b) => ((a.weekday - wd + 7) % 7 || 7) - ((b.weekday - wd + 7) % 7 || 7))[0];
  const day = today ?? upcoming;
  const list = (d: PlanDay, n = d.exercises.length) =>
    d.exercises.slice(0, n).map((e) => `- ${e.name}: ${e.sets} × ${e.reps}`).join("\n");

  if (/(pain|hurt|injur|sore|ache|knee|back|shoulder)/.test(t)) {
    return [
      "Sorry you're dealing with that. A few safe defaults:",
      "- Stop any exercise that causes sharp or worsening pain.\n- Swap to a pain-free range or a lighter variation, or skip that movement today.\n- Mild muscle soreness after training is normal; joint pain isn't something to push through.",
      "I can't give medical advice. If the pain is sharp, lasts more than a few days, or you have an ongoing injury, please check with a doctor or physical therapist. You can also mark it as an injury in Profile → Update answers, and your next plan will avoid loading that area.",
    ].join("\n\n");
  }
  if (/(coin|reward|pro\b|redeem|earn|points)/.test(t)) {
    return [
      `You have ${balance} coins right now. Here's how to earn more:`,
      "- Check in at a partner gym: +40 (once a day)\n- Log your workout: +10 (once a day)\n- Hit every planned day this week: +50 bonus",
      "Spend them in Rewards on partner discounts or a free month of Pro.",
    ].join("\n\n");
  }
  if (/(\b(10|15|20|25)\s*min|short|quick|no time|busy|less time)/.test(t)) {
    if (!day) return "Your plan has no training days yet. Generate a plan first and I'll trim a session for you.";
    return [
      `Short on time? Here's a 20-minute version of ${day.focus}:`,
      day.exercises.slice(0, 3).map((e) => `- ${e.name}: 2 × ${e.reps}`).join("\n"),
      "Keep rest to about 60 seconds and finish with 2 minutes of easy stretching. Still log it: it counts for your streak and coins.",
    ].join("\n\n");
  }
  if (/(form|technique|how do i|how to|squat|deadlift|press|row|lunge|plank)/.test(t)) {
    return [
      "Good form beats heavy weight. General cues:",
      "1. Brace your core before every rep.\n2. Control the lowering phase; 2–3 seconds is plenty.\n3. Stop the set 1–2 reps before your form breaks.",
      "Open the exercise in My Plan to watch its technique video. Each one is from our verified catalog.",
    ].join("\n\n");
  }
  if (/(tired|motivat|skip|lazy|don.?t feel|can.?t be bothered)/.test(t)) {
    return [
      `You're on a ${streak}-day streak. Protect it with the smallest possible win today:`,
      "- Go to the gym and check in (+40 coins), even if you only do 15 minutes.\n- Do the first two exercises of today's plan, then decide.",
      "Most of the hard part is walking in. You pay for the gym; let's make it count.",
    ].join("\n\n");
  }
  if (/(today|workout|plan|what should|session|train)/.test(t) && day) {
    const when = today ? "Today" : `Next up on ${WEEKDAY_NAMES[day.weekday - 1]}`;
    return [
      `${when}: ${day.focus}, ${day.duration_min} minutes.`,
      list(day),
      "Warm up for 5 minutes first. Tap Start session in My Plan when you're at the gym.",
    ].join("\n\n");
  }
  return [
    `I'm your ShowUp coach. I know your plan (${plan.title}), your ${streak}-day streak and your ${balance} coins.`,
    "Try asking me:\n- What's my workout today?\n- I only have 20 minutes\n- How do I earn coins faster?\n- How do I keep good form on squats?",
  ].join("\n\n");
}

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const err = (status: number, code: string, message: string) => json(status, { error: { code, message } });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

function readBody(init?: RequestInit): unknown {
  try {
    return JSON.parse(String(init?.body ?? "{}"));
  } catch {
    return null;
  }
}

export async function mockFetch(path: string, init?: RequestInit): Promise<Response> {
  const scenario = getMockScenario();
  const method = init?.method ?? "GET";
  const isGenerate = method === "POST" && path === API_ROUTES.planGenerate;
  const isNutrition = method === "POST" && path === API_ROUTES.nutritionAnalyze;
  const isCoach = method === "POST" && path === ASSISTANT_ROUTE;
  // SPEC §6: generation takes 5–15 s; the mock sits at the fast end. Photo analysis is AI too.
  await delay(scenario === "slow" ? 2500 : isGenerate ? 5200 : isNutrition ? 3600 : isCoach ? 1100 + Math.random() * 600 : 350 + Math.random() * 300);

  if (scenario === "offline") throw new TypeError("Failed to fetch (mock offline)");
  if (scenario === "unauthorized") return err(401, "unauthorized", "Please sign in to continue.");
  if (scenario === "error") return err(500, "internal_error", "Something went wrong on our side. Please try again.");

  const db = readDb();
  const plan = db.plan ?? mockPlan(new Date(), scenario === "rest_day");

  if (method === "POST") {
    switch (path) {
      case API_ROUTES.onboarding: {
        const parsed = OnboardingRequestSchema.safeParse(readBody(init));
        if (!parsed.success) return err(422, "invalid_data", "Some answers look off. Please review them.");
        const input = parsed.data;
        const profile: Profile = {
          id: "mock-user-0001",
          display_name: db.profile?.display_name ?? (scenario === "new_user" ? null : "Alex"),
          height_cm: input.height_cm,
          weight_kg: input.weight_kg,
          goal: input.goal,
          workout_types: input.workout_types,
          session_minutes: input.session_minutes,
          weekdays: input.weekdays,
          injuries: input.injuries,
          home_gym_id: null,
          is_pro: scenario === "pro",
        };
        writeDb({ ...db, profile, onboarding: input });
        return json(200, { profile });
      }
      case ASSISTANT_ROUTE: {
        const parsed = AssistantRequestSchema.safeParse(readBody(init));
        const last = parsed.success ? parsed.data.messages[parsed.data.messages.length - 1] : null;
        if (!last || last.role !== "user") return err(422, "invalid_data", "Send a message to the coach.");
        const content = mockCoachReply(last.content, plan, currentBalance(scenario, db), baseStreak(scenario));
        return json(200, { reply: { role: "assistant", content } });
      }
      case API_ROUTES.nutritionAnalyze: {
        // SPEC §8: the server checks is_pro before calling the model.
        if (!mockIsPro(scenario, db)) {
          return err(402, "pro_required", "Nutrition analysis is part of ShowUp Pro.");
        }
        const image = init?.body instanceof FormData ? init.body.get("image") : null;
        if (!(image instanceof Blob) || image.size === 0) {
          return err(422, "image_required", "Add a photo of your meal.");
        }
        const items = [
          { name: "Grilled chicken breast", grams_estimate: 150, kcal: 248, protein_g: 46, carbs_g: 0, fat_g: 5 },
          { name: "White rice", grams_estimate: 180, kcal: 234, protein_g: 4, carbs_g: 51, fat_g: 1 },
          { name: "Steamed broccoli", grams_estimate: 90, kcal: 31, protein_g: 3, carbs_g: 6, fat_g: 0 },
          { name: "Olive oil drizzle", grams_estimate: 7, kcal: 62, protein_g: 0, carbs_g: 0, fat_g: 7 },
        ];
        const sum = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") => items.reduce((n, i) => n + i[k], 0);
        return json(200, {
          items,
          totals: { kcal: sum("kcal"), protein_g: sum("protein_g"), carbs_g: sum("carbs_g"), fat_g: sum("fat_g") },
          confidence: "medium",
          disclaimer: "Approximate estimate from a photo. Portions and hidden ingredients (oils, sauces) can change the numbers.",
        });
      }
      case API_ROUTES.billingSubscribe: {
        const body = readBody(init) as { plan?: unknown } | null;
        if (body?.plan !== "pro_monthly") return err(422, "invalid_plan", "Unknown plan.");
        // SPEC §7: simulated payment — the server sets is_pro and pro_until = now + 30 days.
        const proUntil = new Date(Date.now() + 30 * 86_400_000).toISOString();
        writeDb({ ...db, proUntil });
        return json(200, { is_pro: true, pro_until: proUntil });
      }
      case API_ROUTES.rewardsRedeem: {
        const parsed = RedeemRequestSchema.safeParse(readBody(init));
        const reward = parsed.success ? MOCK_REWARDS.rewards.find((r) => r.id === parsed.data.reward_id) : undefined;
        if (!reward || !reward.active) return err(422, "invalid_reward", "That reward isn't available.");
        const balance = currentBalance(scenario, db);
        if (balance < reward.cost_coins) {
          return err(402, "not_enough_coins", `You need ${reward.cost_coins - balance} more coins.`);
        }
        const coinsSpent = (db.coinsSpent ?? 0) + reward.cost_coins;
        if (reward.kind === "pro_month") {
          // Extends from the current Pro end if still active, else from now (SPEC §7: +30 days).
          const from = db.proUntil && new Date(db.proUntil).getTime() > Date.now() ? new Date(db.proUntil) : new Date();
          const proUntil = new Date(from.getTime() + 30 * 86_400_000).toISOString();
          writeDb({ ...db, coinsSpent, proUntil });
          return json(200, { pro_until: proUntil, balance: currentBalance(scenario, { ...db, coinsSpent }) });
        }
        writeDb({ ...db, coinsSpent });
        return json(200, {
          promo_code: mockPromoCode(reward.discount_pct),
          balance: currentBalance(scenario, { ...db, coinsSpent }),
        });
      }
      case API_ROUTES.checkin: {
        const parsed = CheckinRequestSchema.safeParse(readBody(init));
        if (!parsed.success) return err(422, "invalid_data", "Pick a gym and enter the code.");
        const { gym_id, token } = parsed.data;
        if (!MOCK_GYMS.some((g) => g.id === gym_id)) return err(422, "unknown_gym", "That gym isn't a ShowUp partner.");
        const w = minuteWindow();
        // Current and previous window are accepted so a scan at the minute boundary still works.
        if (token !== mockToken(gym_id, w) && token !== mockToken(gym_id, w - 1)) {
          return err(422, "invalid_token", "That code has expired or doesn't match this gym. Use the latest code on the gym screen.");
        }
        const today = localDate();
        if (db.lastCheckinDate === today) {
          return err(409, "already_checked_in", "You've already checked in today. Come back tomorrow.");
        }
        const coinsEarned = (db.coinsEarned ?? 0) + 40;
        writeDb({ ...db, coinsEarned, lastCheckinDate: today });
        return json(200, {
          coins_earned: 40,
          streak: baseStreak(scenario) + 1,
          balance: currentBalance(scenario, { ...db, coinsEarned }),
        });
      }
      case API_ROUTES.sessions: {
        const parsed = SessionRequestSchema.safeParse(readBody(init));
        if (!parsed.success || parsed.data.exercises.length === 0) {
          return err(422, "invalid_data", "Log at least one completed set before finishing.");
        }
        const sets = parsed.data.exercises.reduce((n, e) => n + e.sets.length, 0);
        // XP formula is the backend's call; the mock uses 10 XP per completed set.
        const xp = sets * 10;
        const today = localDate();
        const coins = db.lastSessionDate === today ? 0 : 10;
        const coinsEarned = (db.coinsEarned ?? 0) + coins;
        writeDb({ ...db, coinsEarned, lastSessionDate: today });
        return json(200, { xp_earned: xp, coins_earned: coins, balance: currentBalance(scenario, { ...db, coinsEarned }) });
      }
      case API_ROUTES.planGenerate: {
        if (scenario === "rate_limited") {
          return err(429, "rate_limited", "Free accounts can generate 1 plan per week. Go Pro for unlimited plans.");
        }
        if (scenario === "generate_error") {
          return err(503, "ai_unavailable", "Our AI coach is busy right now. Please try again.");
        }
        // The real server reads the profile; scenarios that start "already onboarded" have none saved here.
        const fallback: OnboardingRequest | undefined =
          scenario === "new_user"
            ? undefined
            : {
                age: 32,
                height_cm: 178,
                weight_kg: 80,
                injuries: [],
                goal: "get_stronger",
                workout_types: ["gym_strength"],
                equipment: ["full_gym"],
                session_minutes: 45,
                weekdays: [1, 3, 5],
              };
        const input = db.onboarding ?? fallback;
        if (!input) {
          return err(422, "onboarding_required", "Complete onboarding before generating a plan.");
        }
        const generated = mockGeneratedPlan(input);
        writeDb({ ...db, plan: generated });
        return json(200, { plan: generated });
      }
      default:
        return err(501, "not_mocked", `No mock for POST ${path} yet.`);
    }
  }

  if (path.startsWith("/api/partner/stats")) {
    const id = new URL(path, "http://mock.local").searchParams.get("partner_id") ?? "";
    // Demo sales seeded per partner; commission_cents = amount_cents × 15 / 100 (SPEC §7).
    const SALES: Record<string, number[]> = {
      "mock-partner-01": [4599, 6299, 3899, 5499, 7999, 4599, 5999, 6799, 3499, 5299, 6499, 3855],
      "mock-partner-02": [8999, 11499, 7299, 9999, 12999],
      "mock-partner-03": [],
    };
    const sales = SALES[id];
    if (!sales) return err(404, "not_found", "We couldn't find that partner.");
    const revenue = sales.reduce((n, c) => n + c, 0);
    const commission = sales.reduce((n, c) => n + Math.round((c * 15) / 100), 0);
    return json(200, { sales_count: sales.length, revenue_cents: revenue, commission_cents: commission });
  }

  const qr = path.match(/^\/api\/gyms\/([^/]+)\/qr-token$/);
  if (qr) {
    const headers = new Headers(init?.headers);
    if (!headers.get("x-gym-key")) return err(401, "invalid_gym_key", "Gym key missing or wrong.");
    const id = decodeURIComponent(qr[1]);
    if (!MOCK_GYMS.some((g) => g.id === id)) return err(404, "not_found", "Gym not found.");
    const now = Date.now() / 1000;
    return json(200, { token: mockToken(id, minuteWindow()), expires_in: Math.ceil(60 - (now % 60)) });
  }

  switch (path) {
    case API_ROUTES.gyms:
      return json(200, { gyms: MOCK_GYMS });
    case API_ROUTES.me:
      return json(200, mockMe(scenario, plan, db));
    case API_ROUTES.planActive:
      if (!db.plan && (scenario === "no_plan" || scenario === "new_user")) {
        return err(404, "not_found", "No active plan yet.");
      }
      return json(200, { plan });
    case API_ROUTES.rewards:
      return json(200, scenario === "empty_rewards" ? { rewards: [] } : MOCK_REWARDS);
    default:
      return err(404, "not_mocked", `No mock for ${path} yet.`);
  }
}
