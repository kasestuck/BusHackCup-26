/**
 * DEVELOPMENT MOCKS — active only when NEXT_PUBLIC_USE_MOCKS=true (SPEC §4).
 *
 * Every response matches a schema in `lib/contract` exactly; the UI shows a
 * "Mock data" badge whenever these are in use so nobody mistakes them for live data.
 * Switch a route off here (or the whole flag) as soon as the backend endpoint works.
 *
 * Scenarios for checking UI states: add `?mock=<scenario>` to the page URL.
 */
import type { MeResponse, Plan, PlanDay, RewardsResponse, Weekday } from "@/lib/contract";
import { API_ROUTES } from "@/lib/contract";

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
] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];

export function getMockScenario(): MockScenario {
  if (typeof window === "undefined") return "default";
  const value = new URLSearchParams(window.location.search).get("mock");
  return (MOCK_SCENARIOS as readonly string[]).includes(value ?? "")
    ? (value as MockScenario)
    : "default";
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

function mockMe(scenario: MockScenario, plan: Plan): MeResponse {
  if (scenario === "new_user") {
    return { profile: null, coins_balance: 0, streak: 0, is_pro: false, has_plan: false };
  }
  const isPro = scenario === "pro";
  return {
    profile: {
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
    },
    coins_balance: 640,
    streak: 6,
    is_pro: isPro,
    has_plan: scenario !== "no_plan",
  };
}

const MOCK_REWARDS: RewardsResponse = {
  rewards: [
    { id: "mock-reward-pro", kind: "pro_month", title: "1 month of ShowUp Pro", partner_id: null, cost_coins: 1200, discount_pct: null, active: true },
    { id: "mock-reward-15", kind: "partner_product", title: "15% off sports nutrition", partner_id: "mock-partner-01", cost_coins: 500, discount_pct: 15, active: true },
    { id: "mock-reward-25", kind: "partner_product", title: "25% off sports nutrition", partner_id: "mock-partner-02", cost_coins: 900, discount_pct: 25, active: true },
  ],
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Only GETs are mocked so far; mutations get mocks with their screens. */
export async function mockFetch(path: string, init?: RequestInit): Promise<Response> {
  if (init?.method && init.method !== "GET") {
    return json(501, { error: { code: "not_mocked", message: `No mock for ${init.method} ${path} yet.` } });
  }
  const scenario = getMockScenario();
  await delay(scenario === "slow" ? 2500 : 350 + Math.random() * 300);

  if (scenario === "offline") throw new TypeError("Failed to fetch (mock offline)");
  if (scenario === "unauthorized") {
    return json(401, { error: { code: "unauthorized", message: "Please sign in to continue." } });
  }
  if (scenario === "error") {
    return json(500, { error: { code: "internal_error", message: "Something went wrong on our side. Please try again." } });
  }

  const plan = mockPlan(new Date(), scenario === "rest_day");

  switch (path) {
    case API_ROUTES.me:
      return json(200, mockMe(scenario, plan));
    case API_ROUTES.planActive:
      if (scenario === "no_plan" || scenario === "new_user") {
        return json(404, { error: { code: "not_found", message: "No active plan yet." } });
      }
      return json(200, { plan });
    case API_ROUTES.rewards:
      return json(200, scenario === "empty_rewards" ? { rewards: [] } : MOCK_REWARDS);
    default:
      return json(404, { error: { code: "not_mocked", message: `No mock for ${path} yet.` } });
  }
}
