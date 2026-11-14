import type { Equipment, Goal, InjuryArea, SessionMinutes, WorkoutType } from "@/lib/contract";

export const GOALS: { value: Goal; title: string; description: string }[] = [
  { value: "lose_fat", title: "Lose fat", description: "Burn more while keeping your strength." },
  { value: "build_muscle", title: "Build muscle", description: "Add size with steady, progressive volume." },
  { value: "get_stronger", title: "Get stronger", description: "Lift heavier on the big movements." },
  { value: "general_fitness", title: "General fitness", description: "Feel better, move better, stay consistent." },
  { value: "endurance", title: "Endurance", description: "Go longer with better conditioning." },
];

export const WORKOUT_TYPES: { value: WorkoutType; title: string; description: string }[] = [
  { value: "gym_strength", title: "Gym strength", description: "Free weights, machines and cables." },
  { value: "home_bodyweight", title: "Home bodyweight", description: "Train anywhere, no gym needed." },
  { value: "cardio_hiit", title: "Cardio & HIIT", description: "Intervals and conditioning work." },
  { value: "mobility_yoga", title: "Mobility & yoga", description: "Flexibility, control and recovery." },
];

export const EQUIPMENT: { value: Equipment; title: string; description: string }[] = [
  { value: "full_gym", title: "Full gym", description: "Racks, machines, cables and free weights." },
  { value: "dumbbells", title: "Dumbbells", description: "A pair or a set at home." },
  { value: "bands", title: "Resistance bands", description: "Loops or tube bands." },
  { value: "none", title: "No equipment", description: "Bodyweight only." },
];

export const INJURY_AREAS: { value: InjuryArea; label: string }[] = [
  { value: "knee", label: "Knee" },
  { value: "lower back", label: "Lower back" },
  { value: "shoulder", label: "Shoulder" },
  { value: "wrist", label: "Wrist" },
  { value: "ankle", label: "Ankle" },
  { value: "other", label: "Other" },
];

export const MINUTES: SessionMinutes[] = [20, 30, 45, 60, 75];

/** Exercises per session from the plan rules in SPEC §8. */
export const EXERCISES_PER_SESSION: Record<SessionMinutes, string> = {
  20: "3–4",
  30: "4–5",
  45: "5–6",
  60: "6–8",
  75: "7–9",
};

export const labelOf = <T extends string>(list: { value: T; title?: string; label?: string }[], v: T) => {
  const o = list.find((x) => x.value === v);
  return o?.title ?? o?.label ?? v;
};
