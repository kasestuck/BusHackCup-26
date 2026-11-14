/**
 * Onboarding questionnaire (SPEC §5): draft state, per-step validation and the
 * conversion to the `POST /api/onboarding` body. Pure — runs under `node --test`.
 */
import type {
  Equipment,
  Goal,
  Injury,
  InjuryArea,
  OnboardingRequest,
  SessionMinutes,
  Weekday,
  WorkoutType,
} from "@/lib/contract";
import { ftInToCm, lbToKg } from "./units.ts";

export type InjuryDraft = { key: string; area: InjuryArea | null; when: string; status: Injury["status"] | null };

export type OnboardingDraft = {
  age: string;
  heightFt: string;
  heightIn: string;
  weightLb: string;
  /** null = not answered yet */
  hasInjuries: boolean | null;
  injuries: InjuryDraft[];
  goal: Goal | null;
  workoutTypes: WorkoutType[];
  equipment: Equipment[];
  sessionMinutes: SessionMinutes | null;
  weekdays: Weekday[];
};

export const EMPTY_DRAFT: OnboardingDraft = {
  age: "",
  heightFt: "",
  heightIn: "",
  weightLb: "",
  hasInjuries: null,
  injuries: [],
  goal: null,
  workoutTypes: [],
  equipment: [],
  sessionMinutes: null,
  weekdays: [],
};

export const STEPS = ["basics", "injuries", "goal", "types", "equipment", "time", "days", "review"] as const;
export type StepId = (typeof STEPS)[number];

/** Field → message. Empty object = step is valid. */
export type StepErrors = Partial<Record<string, string>>;

const int = (s: string) => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : NaN);
const num = (s: string) => (/^\d+(\.\d+)?$/.test(s.trim()) ? Number(s.trim()) : NaN);

export const LIMITS = {
  age: { min: 18, max: 70 },
  heightFt: { min: 4, max: 7 },
  weightLb: { min: 80, max: 600 },
} as const;

export function validateStep(step: StepId, d: OnboardingDraft): StepErrors {
  const e: StepErrors = {};
  switch (step) {
    case "basics": {
      const age = int(d.age);
      if (Number.isNaN(age) || age < LIMITS.age.min || age > LIMITS.age.max) {
        e.age = `Enter an age from ${LIMITS.age.min} to ${LIMITS.age.max}.`;
      }
      const ft = int(d.heightFt);
      const inch = d.heightIn.trim() === "" ? 0 : int(d.heightIn);
      if (Number.isNaN(ft) || ft < LIMITS.heightFt.min || ft > LIMITS.heightFt.max) {
        e.height = `Enter feet from ${LIMITS.heightFt.min} to ${LIMITS.heightFt.max}.`;
      } else if (Number.isNaN(inch) || inch > 11) {
        e.height = "Inches go from 0 to 11.";
      }
      const lb = num(d.weightLb);
      if (Number.isNaN(lb) || lb < LIMITS.weightLb.min || lb > LIMITS.weightLb.max) {
        e.weight = `Enter a weight from ${LIMITS.weightLb.min} to ${LIMITS.weightLb.max} lb.`;
      }
      break;
    }
    case "injuries":
      if (d.hasInjuries === null) e.hasInjuries = "Choose one to continue.";
      else if (d.hasInjuries) {
        if (d.injuries.length === 0) e.hasInjuries = "Add at least one injury, or choose “No injuries”.";
        d.injuries.forEach((inj) => {
          if (!inj.area) e[`${inj.key}.area`] = "Pick the area.";
          if (!inj.when.trim()) e[`${inj.key}.when`] = "Roughly when? e.g. “Mar 2024” or “2 years ago”.";
          if (!inj.status) e[`${inj.key}.status`] = "Is it recovered or ongoing?";
        });
      }
      break;
    case "goal":
      if (!d.goal) e.goal = "Pick your main goal.";
      break;
    case "types":
      if (d.workoutTypes.length === 0) e.workoutTypes = "Pick at least one.";
      break;
    case "equipment":
      if (d.equipment.length === 0) e.equipment = "Pick at least one.";
      break;
    case "time":
      if (!d.sessionMinutes) e.sessionMinutes = "Pick a session length.";
      break;
    case "days":
      if (d.weekdays.length === 0) e.weekdays = "Pick at least one day.";
      break;
    case "review":
      break;
  }
  return e;
}

/** "none" means no equipment, so it can't be combined with anything else. */
export function toggleEquipment(current: Equipment[], value: Equipment): Equipment[] {
  if (current.includes(value)) return current.filter((v) => v !== value);
  if (value === "none") return ["none"];
  return [...current.filter((v) => v !== "none"), value];
}

export function toggleIn<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Build the API body. Call only after every step validates. */
export function toOnboardingRequest(d: OnboardingDraft): OnboardingRequest {
  return {
    age: int(d.age),
    height_cm: ftInToCm(int(d.heightFt), d.heightIn.trim() === "" ? 0 : int(d.heightIn)),
    weight_kg: lbToKg(num(d.weightLb)),
    injuries: d.hasInjuries
      ? d.injuries.map((i) => ({ area: i.area!, when: i.when.trim(), status: i.status! }))
      : [],
    goal: d.goal!,
    workout_types: d.workoutTypes,
    equipment: d.equipment,
    session_minutes: d.sessionMinutes!,
    weekdays: [...d.weekdays].sort((a, b) => a - b),
  };
}
