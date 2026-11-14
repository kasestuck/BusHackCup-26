"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { API_ROUTES, MeResponseSchema, PlanResponseSchema, type Plan } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { useToday } from "@/lib/client/use-today";
import { WEEKDAY_LONG, formatNumber, getNextSession, isoWeekday } from "@/lib/client/dashboard";
import { resolveDayIndex, weekTotals } from "@/lib/client/plan";
import { EARN_RULES } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconCalendar, IconClock, IconDumbbell, IconPlay, IconShield } from "@/components/ui/icons";
import { PlanCalendar } from "./plan-calendar";
import { ExerciseCard } from "./exercise-card";
import { PlanSkeleton } from "./plan-skeleton";

const weekOf = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

export function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">{children}</div>;
}

function Totals({ plan }: { plan: Plan }) {
  const t = weekTotals(plan);
  const items = [
    { label: "Sessions / week", value: t.sessions },
    { label: "Minutes / week", value: formatNumber(t.minutes) },
    { label: "Total sets", value: t.sets },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x divide-line rounded-lg border border-line bg-surface">
      {items.map((i) => (
        <div key={i.label} className="px-4 py-3.5 sm:px-5">
          <dt className="text-xs text-muted">{i.label}</dt>
          <dd className="mt-1 font-display text-2xl font-bold tabular tracking-tight text-ink sm:text-3xl">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function DayDetail({ plan, dayIndex, today }: { plan: Plan; dayIndex: number; today: Date }) {
  const day = plan.days[dayIndex];
  const [open, setOpen] = useState<Set<number>>(() => new Set([0]));
  const isToday = day.weekday === isoWeekday(today);
  const sets = day.exercises.reduce((n, e) => n + e.sets, 0);
  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  return (
    <section aria-labelledby="day-heading" className="rise space-y-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-3">
          {isToday ? (
            <Badge tone="lime" dot>
              Today · {WEEKDAY_LONG[day.weekday - 1]}
            </Badge>
          ) : (
            <Badge>{WEEKDAY_LONG[day.weekday - 1]}</Badge>
          )}
          <h2 id="day-heading" className="font-display text-title font-bold text-ink">
            {day.focus}
          </h2>
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <IconClock size={15} /> {day.duration_min} min
            </span>
            <span className="inline-flex items-center gap-1.5">
              <IconDumbbell size={15} /> {day.exercises.length} exercises
            </span>
            <span className="tabular">{sets} sets</span>
          </p>
        </div>
        <ButtonLink href={`/workout/${dayIndex}`} size="lg" icon={<IconPlay size={18} />} className="sm:shrink-0">
          {isToday ? "Start session" : "Start this session"}
        </ButtonLink>
      </div>

      {day.exercises.length === 0 ? (
        <Card>
          <EmptyState compact title="No exercises on this day" description="Try regenerating your plan." />
        </Card>
      ) : (
        <ol className="space-y-2.5" aria-label={`${day.focus} exercises`}>
          {day.exercises.map((ex, i) => (
            <ExerciseCard key={`${ex.slug}-${i}`} exercise={ex} index={i} open={open.has(i)} onToggle={() => toggle(i)} />
          ))}
        </ol>
      )}
    </section>
  );
}

function Sidebar({ plan, today }: { plan: Plan; today: Date }) {
  const next = getNextSession(plan, today);
  const session = EARN_RULES.find((r) => r.key === "session")!;
  const checkin = EARN_RULES.find((r) => r.key === "checkin")!;
  const week = EARN_RULES.find((r) => r.key === "week")!;
  return (
    <aside className="space-y-4 lg:sticky lg:top-28">
      <Card className="rise p-5" style={{ ["--d" as string]: "120ms" }}>
        <Eyebrow>Every session pays</Eyebrow>
        <ul className="mt-4 space-y-3.5">
          {[checkin, session, week].map((r) => (
            <li key={r.key} className="flex items-baseline gap-3">
              <span className="w-12 shrink-0 font-display text-xl font-bold tabular tracking-tight text-lime">+{r.coins}</span>
              <span className="text-sm text-ink">{r.title}</span>
            </li>
          ))}
        </ul>
        {next && (
          <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
            Up next after today: <span className="text-ink">{WEEKDAY_LONG[next.day.weekday - 1]}</span> ·{" "}
            {next.day.focus}
          </p>
        )}
      </Card>
      <Card className="rise p-5" style={{ ["--d" as string]: "180ms" }}>
        <p className="flex items-start gap-3 text-sm leading-relaxed text-muted">
          <IconShield size={18} className="mt-0.5 shrink-0 text-subtle" />
          <span>
            {plan.safety_note} Stop any exercise that causes pain. Warm up before working sets.
          </span>
        </p>
      </Card>
    </aside>
  );
}

export function PlanView() {
  const today = useToday();
  const router = useRouter();
  const params = useSearchParams();
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);
  const [planRes, retryPlan] = useApi(API_ROUTES.planActive, PlanResponseSchema);

  if (!today || planRes.status === "loading") {
    return (
      <Frame>
        <PlanSkeleton />
      </Frame>
    );
  }

  if (planRes.status === "error") {
    if (planRes.error.status === 404) {
      const onboarded = me.status === "success" && me.data.profile !== null;
      return (
        <Frame>
          <Card className="mx-auto max-w-xl">
            <EmptyState
              icon={<IconCalendar />}
              title="No plan yet"
              description="Your weekly plan, with a technique video for every exercise, appears here once it's generated."
              action={
                <ButtonLink href={onboarded ? "/onboarding/generate" : "/onboarding"} arrow>
                  {onboarded ? "Generate my plan" : "Build my plan"}
                </ButtonLink>
              }
            />
          </Card>
        </Frame>
      );
    }
    const kind = errorKindFromStatus(planRes.error.status);
    return (
      <Frame>
        <Card className="mx-auto max-w-lg">
          <ErrorState
            kind={kind}
            message={planRes.error.message}
            onRetry={retryPlan}
            action={kind === "auth" ? <ButtonLink href="/login" arrow>Sign in</ButtonLink> : undefined}
          />
        </Card>
      </Frame>
    );
  }

  const plan = planRes.data.plan;
  const dayIndex = resolveDayIndex(plan, today, params.get("day"));
  const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (isoWeekday(today) - 1));

  const select = (i: number) => router.replace(`/plan?day=${i}`, { scroll: false });

  return (
    <Frame>
      <div className="space-y-10 lg:space-y-12">
        <header className="rise grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="space-y-4 lg:col-span-7">
            <Eyebrow>
              My plan <span className="px-1.5 text-subtle">/</span> Week of {weekOf.format(monday)}
            </Eyebrow>
            <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
              {plan.title}
              <span className="text-lime">.</span>
            </h1>
            <p className="text-lg text-muted">{plan.summary}</p>
          </div>
          <div className="space-y-3 lg:col-span-5">
            <Totals plan={plan} />
            <ButtonLink href="/onboarding" variant="ghost" className="h-9 px-2 text-sm">
              Update my answers
            </ButtonLink>
          </div>
        </header>

        {dayIndex === -1 ? (
          <Card>
            <EmptyState compact title="Your plan has no training days" description="Update your answers and generate a new plan." />
          </Card>
        ) : (
          <>
            <PlanCalendar plan={plan} today={today} selected={dayIndex} onSelect={select} />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
              <div className="lg:col-span-8">
                <DayDetail key={dayIndex} plan={plan} dayIndex={dayIndex} today={today} />
              </div>
              <div className="lg:col-span-4">
                <Sidebar plan={plan} today={today} />
              </div>
            </div>
          </>
        )}
      </div>
    </Frame>
  );
}
