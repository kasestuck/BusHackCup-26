import Link from "next/link";
import type { MeResponse, Plan } from "@/lib/contract";
import { WEEKDAY_LONG, WEEKDAY_SHORT, type ScheduledDay } from "@/lib/client/dashboard";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/section-header";
import { IconClock, IconDumbbell, IconPlay, IconSpark } from "@/components/ui/icons";

function Meta({ minutes, exercises, sets }: { minutes: number; exercises: number; sets: number }) {
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-md border border-line bg-bg/40">
      {[
        { label: "Duration", value: minutes, unit: "min", icon: <IconClock size={15} /> },
        { label: "Exercises", value: exercises, unit: "", icon: <IconDumbbell size={15} /> },
        { label: "Total sets", value: sets, unit: "", icon: null },
      ].map((m) => (
        <div key={m.label} className="px-3 py-3 sm:px-4">
          <dt className="flex items-center gap-1.5 text-xs text-muted">
            {m.icon}
            {m.label}
          </dt>
          <dd className="mt-1 font-display text-2xl font-semibold tabular tracking-tight text-ink">
            {m.value}
            {m.unit && <span className="ml-1 text-sm font-medium text-muted">{m.unit}</span>}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function TodayCard({
  plan,
  today,
  next,
}: {
  plan: Plan;
  today: ScheduledDay | null;
  next: (ScheduledDay & { daysAway: number }) | null;
}) {
  const session = today ?? next;
  if (!session) {
    return (
      <Card tone="feature" className="p-6 sm:p-7">
        <Eyebrow>{plan.title}</Eyebrow>
        <p className="mt-3 text-muted">Your plan has no training days yet.</p>
      </Card>
    );
  }

  const { day, dayIndex } = session;
  const totalSets = day.exercises.reduce((n, e) => n + e.sets, 0);
  const shown = day.exercises.slice(0, 4);
  const more = day.exercises.length - shown.length;
  const href = `/plan?day=${dayIndex}`;
  const nextLabel =
    !today && next ? (next.daysAway === 1 ? "Tomorrow" : WEEKDAY_LONG[next.day.weekday - 1]) : null;

  return (
    <Card tone="feature" className="rise flex h-full flex-col p-5 sm:p-7" style={{ ["--d" as string]: "120ms" }}>
      <div className="flex items-center justify-between gap-3">
        {today ? (
          <Badge tone="lime" dot>
            Today · {WEEKDAY_SHORT[day.weekday - 1]}
          </Badge>
        ) : (
          <Badge>Rest day · Up next {nextLabel}</Badge>
        )}
        <span className="text-xs font-medium text-subtle tabular">
          Day {dayIndex + 1} of {plan.days.length}
        </span>
      </div>

      <div className="mt-6 space-y-1.5">
        <Eyebrow>{today ? "Today's workout" : "Next workout"}</Eyebrow>
        <h2 className="font-display text-title font-bold text-ink">{day.focus}</h2>
      </div>

      <div className="mt-5">
        <Meta minutes={day.duration_min} exercises={day.exercises.length} sets={totalSets} />
      </div>

      <ol className="mt-5 space-y-px" aria-label={`${day.focus} exercises`}>
        {shown.map((ex, i) => (
          <li key={ex.slug} className="flex items-baseline gap-3 py-1.5 text-[0.9375rem]">
            <span className="w-5 shrink-0 font-display text-xs font-semibold tabular text-subtle">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 flex-1 truncate text-ink">{ex.name}</span>
            <span className="shrink-0 text-sm tabular text-muted">
              {ex.sets} × {ex.reps}
            </span>
          </li>
        ))}
        {more > 0 && (
          <li className="pl-8 pt-1 text-sm text-subtle">
            + {more} more exercise{more > 1 ? "s" : ""}
          </li>
        )}
      </ol>

      <div className="mt-auto pt-6">
        {today ? (
          <Link
            href={href}
            className="group flex h-14 items-center justify-between rounded-md border border-lime-line bg-lime-soft pl-5 pr-2 font-display font-semibold text-ink transition-[background-color,border-color,transform] duration-200 hover:border-lime hover:bg-lime/15 active:scale-[0.98]"
          >
            Start session
            <span className="grid size-10 place-items-center rounded-md bg-lime text-lime-ink transition-transform duration-300 ease-out-expo group-hover:translate-x-0.5">
              <IconPlay size={16} />
            </span>
          </Link>
        ) : (
          <div className="space-y-3">
            <p className="flex items-start gap-2 text-sm text-muted">
              <IconSpark size={16} className="mt-0.5 shrink-0 text-lime" />
              Recovery is part of the plan. A gym check-in still earns coins today.
            </p>
            <ButtonLink href={href} variant="secondary" className="w-full" arrow>
              Preview {nextLabel === "Tomorrow" ? "tomorrow's" : `${nextLabel}'s`} workout
            </ButtonLink>
          </div>
        )}
      </div>
    </Card>
  );
}

/** Shown in place of the workout card when there is no active plan. */
export function NoPlanCard({ me }: { me: MeResponse }) {
  const onboarded = me.profile !== null;
  return (
    <Card tone="feature" className="rise flex h-full flex-col justify-between gap-8 p-6 sm:p-7" style={{ ["--d" as string]: "120ms" }}>
      <div className="space-y-4">
        <Badge tone="lime" dot>
          {onboarded ? "Step 2 of 2" : "Step 1 of 2"}
        </Badge>
        <h2 className="font-display text-title font-bold text-ink">
          {onboarded ? "Generate your AI plan" : "Set up your training profile"}
        </h2>
        <p className="leading-relaxed text-muted">
          {onboarded
            ? "We'll build a week of workouts around your days, time and equipment, with a technique video for every exercise."
            : "Height, weight, injuries, goal, schedule and equipment. Two minutes, then your AI plan is ready."}
        </p>
      </div>
      <ButtonLink href={onboarded ? "/onboarding/generate" : "/onboarding"} arrow className="w-full sm:w-auto">
        {onboarded ? "Generate my plan" : "Start onboarding"}
      </ButtonLink>
    </Card>
  );
}
