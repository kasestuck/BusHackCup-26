"use client";

import { useEffect, useRef, useState } from "react";
import type { Plan } from "@/lib/contract";
import type { GenerationState } from "@/lib/client/use-plan-generation";
import { WEEKDAY_LONG } from "@/lib/client/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { IconAlert, IconClock, IconDumbbell, IconLock, IconRefresh, IconShield, IconSpark, IconWifiOff } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

/* ------------------------------- Running -------------------------------- */

/** The server pipeline from SPEC §8, in order. */
function stages(days?: number) {
  return [
    "Reading your answers",
    "Filtering exercises for your equipment and injuries",
    days ? `Building ${days} training day${days > 1 ? "s" : ""}` : "Building your training days",
    "Attaching a technique video to every exercise",
  ];
}

function Running({ days }: { days?: number }) {
  const list = stages(days);
  const [active, setActive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setActive((a) => Math.min(a + 1, list.length - 1)), 2600);
    return () => clearInterval(id);
  }, [list.length]);

  return (
    <div className="rise space-y-10" aria-busy="true">
      <div className="space-y-5">
        <Badge tone="lime" dot>
          AI coach at work
        </Badge>
        <h1 className="font-display text-hero font-bold text-ink">
          Building your plan<span className="text-lime">.</span>
        </h1>
        <p className="max-w-[42ch] text-lg text-muted">This takes 5 to 15 seconds. Keep this page open.</p>
      </div>

      <div className="relative h-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
        <div className="absolute inset-y-0 w-1/3 animate-scan rounded-full bg-lime" />
      </div>

      <ol className="space-y-4" aria-live="polite">
        {list.map((s, i) => (
          <li
            key={s}
            className={cx(
              "flex items-center gap-4 text-[0.9375rem] transition-colors duration-500",
              i === active ? "text-ink" : i < active ? "text-muted" : "text-subtle",
            )}
            aria-current={i === active ? "step" : undefined}
          >
            <span
              aria-hidden="true"
              className={cx(
                "size-2 shrink-0 rounded-full transition-colors duration-500",
                i === active ? "animate-pulse-dot bg-lime" : i < active ? "bg-lime/50" : "bg-white/15",
              )}
            />
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --------------------------------- Error -------------------------------- */

function Failed({ status, message, onRetry }: { status: number; message: string; onRetry: () => void }) {
  const limited = status === 429;
  const auth = status === 401;
  const offline = status === 0;
  const title = limited
    ? "Plan limit reached"
    : auth
      ? "Sign in to continue"
      : offline
        ? "You're offline"
        : "We couldn't build your plan";
  return (
    <div role="alert" className="rise space-y-8">
      <div className="grid size-12 place-items-center rounded-md border border-line-strong bg-surface-2">
        {offline ? <IconWifiOff /> : auth ? <IconLock /> : <IconAlert className={limited ? "text-warning" : "text-danger"} />}
      </div>
      <div className="space-y-4">
        <h1 className="font-display text-[clamp(2.25rem,1.6rem+3vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="max-w-[46ch] text-lg text-muted">{message}</p>
        {!limited && !auth && (
          <p className="text-sm text-subtle">Your answers are saved. Trying again won&apos;t ask them twice.</p>
        )}
      </div>
      <div className="flex flex-wrap gap-3">
        {auth ? (
          <ButtonLink href="/login" size="lg" arrow>
            Sign in
          </ButtonLink>
        ) : limited ? null : (
          <Button size="lg" onClick={onRetry} icon={<IconRefresh size={18} />}>
            Try again
          </Button>
        )}
        <ButtonLink href="/dashboard" variant="secondary" size="lg">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

/* --------------------------------- Ready -------------------------------- */

function Ready({ plan }: { plan: Plan }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="space-y-10">
      <div className="rise space-y-5">
        <Badge tone="solid">Plan ready</Badge>
        <h1 ref={heading} tabIndex={-1} className="font-display text-hero font-bold text-ink outline-none">
          Your plan is ready<span className="text-lime">.</span>
        </h1>
        <div>
          <p className="font-display text-xl font-semibold text-ink sm:text-2xl">{plan.title}</p>
          <p className="mt-1 text-muted">{plan.summary}</p>
        </div>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2" aria-label="Training days">
        {plan.days.map((d, i) => (
          <li key={d.weekday}>
            <Card className="rise h-full p-5" style={{ ["--d" as string]: `${120 + i * 70}ms` }}>
              <Eyebrow>{WEEKDAY_LONG[d.weekday - 1]}</Eyebrow>
              <p className="mt-2 font-display text-xl font-semibold text-ink">{d.focus}</p>
              <p className="mt-2 flex items-center gap-4 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <IconClock size={13} /> {d.duration_min} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconDumbbell size={13} /> {d.exercises.length} exercises
                </span>
              </p>
              <p className="mt-3 line-clamp-2 text-sm text-subtle">
                {d.exercises.map((e) => e.name).join(" · ")}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <p className="flex items-start gap-3 rounded-md border border-line bg-surface px-4 py-3.5 text-sm leading-relaxed text-muted">
        <IconShield size={18} className="mt-0.5 shrink-0 text-subtle" />
        {plan.safety_note}
      </p>

      <ButtonLink href="/dashboard" size="lg" arrow className="w-full sm:w-auto">
        Go to my dashboard
      </ButtonLink>
    </div>
  );
}

/* --------------------------------- Idle --------------------------------- */

function Idle({ onStart }: { onStart: () => void }) {
  return (
    <div className="rise space-y-8">
      <Badge tone="lime" dot>
        Profile saved
      </Badge>
      <h1 className="font-display text-hero font-bold text-ink">
        Let&apos;s build your plan<span className="text-lime">.</span>
      </h1>
      <p className="max-w-[44ch] text-lg text-muted">
        Your AI coach builds a week of workouts from your answers, with a technique video for every exercise.
      </p>
      <div className="flex flex-wrap gap-3">
        <Button size="lg" onClick={onStart} icon={<IconSpark size={18} />}>
          Generate my plan
        </Button>
        <ButtonLink href="/onboarding" variant="secondary" size="lg">
          Update my answers
        </ButtonLink>
      </div>
      <p className="text-sm text-subtle">Free accounts can generate one plan per week.</p>
    </div>
  );
}

export function GenerationView({
  state,
  onStart,
  days,
}: {
  state: GenerationState;
  onStart: () => void;
  days?: number;
}) {
  switch (state.status) {
    case "idle":
      return <Idle onStart={onStart} />;
    case "running":
      return <Running days={days} />;
    case "error":
      return <Failed status={state.error.status} message={state.error.message} onRetry={onStart} />;
    case "success":
      return <Ready plan={state.plan} />;
  }
}
