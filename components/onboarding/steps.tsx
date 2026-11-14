"use client";

import type { Weekday } from "@/lib/contract";
import {
  type InjuryDraft,
  type OnboardingDraft,
  type StepErrors,
  type StepId,
  toggleEquipment,
  toggleIn,
} from "@/lib/client/onboarding";
import { WEEKDAY_LONG, WEEKDAY_SHORT } from "@/lib/client/dashboard";
import { ChoiceCard, ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconAlert } from "@/components/ui/icons";
import {
  EQUIPMENT,
  EXERCISES_PER_SESSION,
  GOALS,
  INJURY_AREAS,
  MINUTES,
  WORKOUT_TYPES,
  labelOf,
} from "./options";

export type StepProps = {
  draft: OnboardingDraft;
  update: (patch: Partial<OnboardingDraft>) => void;
  errors: StepErrors;
};

let injuryKey = 0;
const newInjury = (): InjuryDraft => ({ key: `inj-${++injuryKey}`, area: null, when: "", status: null });

/* --------------------------------- Basics -------------------------------- */

function BasicsStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-7">
      <Input
        label="Age"
        inputMode="numeric"
        autoComplete="off"
        placeholder="32"
        suffix="years"
        value={draft.age}
        onChange={(e) => update({ age: e.target.value })}
        error={errors.age}
        className="max-w-xs"
      />
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-ink">Height</legend>
        <div className="grid max-w-sm grid-cols-2 gap-3">
          <Input
            label="Feet"
            inputMode="numeric"
            placeholder="5"
            suffix="ft"
            value={draft.heightFt}
            onChange={(e) => update({ heightFt: e.target.value })}
            aria-invalid={errors.height ? true : undefined}
          />
          <Input
            label="Inches"
            inputMode="numeric"
            placeholder="10"
            suffix="in"
            value={draft.heightIn}
            onChange={(e) => update({ heightIn: e.target.value })}
            aria-invalid={errors.height ? true : undefined}
          />
        </div>
        {errors.height && (
          <p role="alert" className="text-xs font-medium text-danger">
            {errors.height}
          </p>
        )}
      </fieldset>
      <Input
        label="Weight"
        inputMode="decimal"
        placeholder="180"
        suffix="lb"
        value={draft.weightLb}
        onChange={(e) => update({ weightLb: e.target.value })}
        error={errors.weight}
        className="max-w-xs"
      />
    </div>
  );
}

/* -------------------------------- Injuries ------------------------------- */

function InjuryEditor({
  injury,
  index,
  onChange,
  onRemove,
  errors,
}: {
  injury: InjuryDraft;
  index: number;
  onChange: (patch: Partial<InjuryDraft>) => void;
  onRemove: () => void;
  errors: StepErrors;
}) {
  return (
    <Card tone="raised" className="space-y-5 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-ink">Injury {index + 1}</p>
        <Button variant="ghost" className="-mr-2 h-9 px-3 text-sm" onClick={onRemove}>
          Remove
        </Button>
      </div>
      <ChoiceGroup legend="Area" error={errors[`${injury.key}.area`]}>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {INJURY_AREAS.map((a) => (
            <ChoiceChip
              key={a.value}
              name={`${injury.key}-area`}
              value={a.value}
              label={a.label}
              checked={injury.area === a.value}
              onChange={() => onChange({ area: a.value })}
            />
          ))}
        </div>
      </ChoiceGroup>
      <Input
        label="When did it happen?"
        placeholder="e.g. Mar 2024 or 2 years ago"
        value={injury.when}
        onChange={(e) => onChange({ when: e.target.value })}
        error={errors[`${injury.key}.when`]}
      />
      <ChoiceGroup legend="Status" error={errors[`${injury.key}.status`]}>
        <div className="grid grid-cols-2 gap-2">
          {(["recovered", "ongoing"] as const).map((s) => (
            <ChoiceChip
              key={s}
              name={`${injury.key}-status`}
              value={s}
              label={s === "recovered" ? "Recovered" : "Ongoing"}
              checked={injury.status === s}
              onChange={() => onChange({ status: s })}
            />
          ))}
        </div>
      </ChoiceGroup>
      {injury.status === "ongoing" && (
        <p className="flex items-start gap-2 rounded-md border border-warning/25 bg-warning-soft px-3 py-2.5 text-xs leading-relaxed text-warning">
          <IconAlert size={15} className="mt-px shrink-0" />
          Exercises that load this area are removed before your plan is built. Please check with a doctor before
          training around an ongoing injury.
        </p>
      )}
    </Card>
  );
}

function InjuriesStep({ draft, update, errors }: StepProps) {
  const setInjury = (key: string, patch: Partial<InjuryDraft>) =>
    update({ injuries: draft.injuries.map((i) => (i.key === key ? { ...i, ...patch } : i)) });

  return (
    <div className="space-y-6">
      <ChoiceGroup legend="Do you have any injuries?" hideLegend error={errors.hasInjuries}>
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            name="has-injuries"
            value="no"
            title="No injuries"
            description="Nothing to work around."
            checked={draft.hasInjuries === false}
            onChange={() => update({ hasInjuries: false })}
          />
          <ChoiceCard
            name="has-injuries"
            value="yes"
            title="Yes, work around them"
            description="Past or current injuries."
            checked={draft.hasInjuries === true}
            onChange={() =>
              update({ hasInjuries: true, injuries: draft.injuries.length ? draft.injuries : [newInjury()] })
            }
          />
        </div>
      </ChoiceGroup>

      {draft.hasInjuries && (
        <div className="space-y-4">
          {draft.injuries.map((inj, i) => (
            <InjuryEditor
              key={inj.key}
              injury={inj}
              index={i}
              errors={errors}
              onChange={(p) => setInjury(inj.key, p)}
              onRemove={() => update({ injuries: draft.injuries.filter((x) => x.key !== inj.key) })}
            />
          ))}
          <Button variant="secondary" onClick={() => update({ injuries: [...draft.injuries, newInjury()] })}>
            + Add {draft.injuries.length ? "another" : "an"} injury
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ Single/multi ----------------------------- */

function GoalStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceGroup legend="Main goal" hideLegend error={errors.goal}>
      <div className="grid gap-3">
        {GOALS.map((g) => (
          <ChoiceCard
            key={g.value}
            name="goal"
            value={g.value}
            title={g.title}
            description={g.description}
            checked={draft.goal === g.value}
            onChange={() => update({ goal: g.value })}
          />
        ))}
      </div>
    </ChoiceGroup>
  );
}

function TypesStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceGroup legend="Workout types" hint="Pick all that apply." hideLegend error={errors.workoutTypes}>
      <div className="grid gap-3 sm:grid-cols-2">
        {WORKOUT_TYPES.map((t) => (
          <ChoiceCard
            key={t.value}
            type="checkbox"
            name="workout-types"
            value={t.value}
            title={t.title}
            description={t.description}
            checked={draft.workoutTypes.includes(t.value)}
            onChange={() => update({ workoutTypes: toggleIn(draft.workoutTypes, t.value) })}
          />
        ))}
      </div>
    </ChoiceGroup>
  );
}

function EquipmentStep({ draft, update, errors }: StepProps) {
  return (
    <ChoiceGroup legend="Equipment" hint="Pick all you have access to." hideLegend error={errors.equipment}>
      <div className="grid gap-3 sm:grid-cols-2">
        {EQUIPMENT.map((t) => (
          <ChoiceCard
            key={t.value}
            type="checkbox"
            name="equipment"
            value={t.value}
            title={t.title}
            description={t.description}
            checked={draft.equipment.includes(t.value)}
            onChange={() => update({ equipment: toggleEquipment(draft.equipment, t.value) })}
          />
        ))}
      </div>
    </ChoiceGroup>
  );
}

function TimeStep({ draft, update, errors }: StepProps) {
  return (
    <div className="space-y-6">
      <ChoiceGroup legend="Minutes per session" hideLegend error={errors.sessionMinutes}>
        <div className="grid grid-cols-5 gap-2 sm:gap-3">
          {MINUTES.map((m) => (
            <ChoiceChip
              key={m}
              size="lg"
              name="session-minutes"
              value={String(m)}
              label={m}
              sublabel="min"
              checked={draft.sessionMinutes === m}
              onChange={() => update({ sessionMinutes: m })}
            />
          ))}
        </div>
      </ChoiceGroup>
      <p aria-live="polite" className="min-h-5 text-sm text-muted">
        {draft.sessionMinutes &&
          `About ${EXERCISES_PER_SESSION[draft.sessionMinutes]} exercises per session.`}
      </p>
    </div>
  );
}

function DaysStep({ draft, update, errors }: StepProps) {
  const n = draft.weekdays.length;
  return (
    <div className="space-y-6">
      <ChoiceGroup legend="Training days" hideLegend error={errors.weekdays}>
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {WEEKDAY_SHORT.map((label, i) => {
            const w = (i + 1) as Weekday;
            return (
              <ChoiceChip
                key={w}
                type="checkbox"
                size="lg"
                name="weekdays"
                value={String(w)}
                label={<span className="text-base sm:text-lg">{label}</span>}
                checked={draft.weekdays.includes(w)}
                onChange={() => update({ weekdays: toggleIn(draft.weekdays, w) })}
                className="px-0"
              />
            );
          })}
        </div>
      </ChoiceGroup>
      <div aria-live="polite" className="flex items-baseline gap-3">
        <span className="font-display text-metric font-bold tabular text-ink">{n}</span>
        <span className="text-muted">
          {n === 1 ? "workout" : "workouts"} a week
          {n >= 6 && <span className="text-subtle"> · leave a day for recovery</span>}
        </span>
      </div>
    </div>
  );
}

/* --------------------------------- Review -------------------------------- */

function ReviewStep({ draft, onEdit }: { draft: OnboardingDraft; onEdit: (step: StepId) => void }) {
  const rows: { step: StepId; label: string; value: string }[] = [
    {
      step: "basics",
      label: "About you",
      value: `${draft.age} years · ${draft.heightFt}′${draft.heightIn || 0}″ · ${draft.weightLb} lb`,
    },
    {
      step: "injuries",
      label: "Injuries",
      value: draft.hasInjuries
        ? draft.injuries
            .map((i) => `${labelOf(INJURY_AREAS, i.area!)} (${i.status}, ${i.when.trim()})`)
            .join(", ")
        : "None",
    },
    { step: "goal", label: "Goal", value: labelOf(GOALS, draft.goal!) },
    { step: "types", label: "Training", value: draft.workoutTypes.map((t) => labelOf(WORKOUT_TYPES, t)).join(", ") },
    { step: "equipment", label: "Equipment", value: draft.equipment.map((e) => labelOf(EQUIPMENT, e)).join(", ") },
    { step: "time", label: "Session", value: `${draft.sessionMinutes} minutes` },
    {
      step: "days",
      label: "Days",
      value: [...draft.weekdays]
        .sort((a, b) => a - b)
        .map((w) => WEEKDAY_LONG[w - 1])
        .join(", "),
    },
  ];

  return (
    <Card className="divide-y divide-line">
      {rows.map((r) => (
        <div key={r.step} className="flex items-start gap-4 px-4 py-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted">{r.label}</p>
            <p className="mt-1 text-[0.9375rem] text-ink">{r.value}</p>
          </div>
          <Button
            variant="ghost"
            className="-my-1 h-10 shrink-0 px-3 text-sm"
            onClick={() => onEdit(r.step)}
            aria-label={`Edit ${r.label.toLowerCase()}`}
          >
            Edit
          </Button>
        </div>
      ))}
    </Card>
  );
}

/* ------------------------------- Step meta ------------------------------- */

export const STEP_META: Record<StepId, { title: string; why: string }> = {
  basics: {
    title: "Let's start with the basics.",
    why: "We use these to set sensible loads and volume. You see US units; we store metric.",
  },
  injuries: {
    title: "Anything we should work around?",
    why: "Ongoing injuries remove risky exercises from the list before the AI ever sees it.",
  },
  goal: { title: "What's your main goal?", why: "One clear goal makes a sharper plan." },
  types: { title: "How do you like to train?", why: "Your plan mixes only the styles you pick." },
  equipment: { title: "What can you train with?", why: "The AI never assigns equipment you don't have." },
  time: { title: "How long is a session?", why: "Every workout is built to fit this window." },
  days: {
    title: "Which days can you show up?",
    why: "One training day for each day you pick. Weekly bonus coins when you hit them all.",
  },
  review: {
    title: "Ready when you are.",
    why: "Check your answers. Your AI plan, with a technique video for every exercise, takes 5 to 15 seconds to build.",
  },
};

export function StepBody({
  step,
  onEdit,
  ...props
}: StepProps & { step: StepId; onEdit: (s: StepId) => void }) {
  switch (step) {
    case "basics":
      return <BasicsStep {...props} />;
    case "injuries":
      return <InjuriesStep {...props} />;
    case "goal":
      return <GoalStep {...props} />;
    case "types":
      return <TypesStep {...props} />;
    case "equipment":
      return <EquipmentStep {...props} />;
    case "time":
      return <TimeStep {...props} />;
    case "days":
      return <DaysStep {...props} />;
    case "review":
      return <ReviewStep draft={props.draft} onEdit={onEdit} />;
  }
}
