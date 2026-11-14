"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  API_ROUTES,
  PlanResponseSchema,
  SessionResponseSchema,
  type Plan,
  type SessionResponse,
} from "@/lib/contract";
import { apiPost, type ApiError } from "@/lib/client/api";
import { invalidateApi, useApi } from "@/lib/client/use-api";
import { WEEKDAY_LONG } from "@/lib/client/dashboard";
import {
  countSets,
  draftKey,
  formatElapsed,
  initialLog,
  restoreLog,
  toSessionRequest,
  type WorkoutLog,
} from "@/lib/client/workout";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconAlert, IconCalendar, IconShield } from "@/components/ui/icons";
import { Eyebrow } from "@/components/ui/section-header";
import { FlowHeader } from "@/components/onboarding/flow-header";
import { ExerciseLogger } from "./exercise-logger";
import { RestTimer } from "./rest-timer";
import { SessionResult } from "./session-result";
import { SignInButton, SignInLink } from "@/components/auth/sign-in";

const LEAVE_MESSAGE = "Leave this workout? Your logged sets stay saved in this tab until you finish.";

function storageGet(key: string) {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function storageSet(key: string, value: string | null) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    // Storage blocked: the workout still works, it just won't survive a refresh.
  }
}

function ElapsedClock({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <span className="inline-flex items-center gap-2 font-display text-sm font-semibold tabular text-ink" aria-label="Elapsed time">
      <span className="size-1.5 animate-pulse-dot rounded-full bg-lime" aria-hidden="true" />
      {formatElapsed((now - startedAt) / 1000)}
    </span>
  );
}

function Shell({ children, header }: { children: React.ReactNode; header?: React.ReactNode }) {
  return (
    <>
      {header ?? <FlowHeader exitHref="/plan" />}
      <main id="main" className="mx-auto max-w-[880px] px-4 pb-40 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {children}
      </main>
    </>
  );
}

function Session({ plan, dayIndex }: { plan: Plan; dayIndex: number }) {
  const day = plan.days[dayIndex];
  const key = draftKey(plan.id, dayIndex);
  const [log, setLog] = useState<WorkoutLog>(
    () => restoreLog(storageGet(key), day) ?? initialLog(day, Date.now()),
  );
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [result, setResult] = useState<{ data: SessionResponse; sets: number; elapsed: number } | null>(null);

  const { done, total } = countSets(log);
  const dirty = done > 0 && !result;

  // Keep the draft through refreshes; drop it once the session is saved.
  useEffect(() => {
    storageSet(key, result ? null : JSON.stringify(log));
  }, [key, log, result]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const endRest = useCallback(() => setRest(null), []);

  async function finish() {
    if (done < total && !confirming) {
      setConfirming(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    const res = await apiPost(API_ROUTES.sessions, SessionResponseSchema, toSessionRequest(plan, dayIndex, log));
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    invalidateApi();
    setRest(null);
    setResult({ data: res.data, sets: done, elapsed: (Date.now() - log.startedAt) / 1000 });
    window.scrollTo({ top: 0 });
  }

  if (result) {
    return (
      <Shell>
        <SessionResult result={result.data} focus={day.focus} sets={result.sets} elapsedSec={result.elapsed} />
      </Shell>
    );
  }

  return (
    <Shell
      header={
        <FlowHeader
          exitHref="/plan"
          exitConfirm={dirty ? LEAVE_MESSAGE : undefined}
          center={<ElapsedClock startedAt={log.startedAt} />}
        />
      }
    >
      <div className="space-y-8">
        <header className="rise space-y-3">
          <Eyebrow>
            Session <span className="px-1.5 text-subtle">/</span> {WEEKDAY_LONG[day.weekday - 1]}
          </Eyebrow>
          <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
            {day.focus}
            <span className="text-lime">.</span>
          </h1>
          <p className="text-muted">
            {plan.title} · {day.exercises.length} exercises · {day.duration_min} min
          </p>
        </header>

        <ol className="space-y-4" aria-label="Exercises">
          {day.exercises.map((ex, i) => (
            <li key={`${ex.slug}-${i}`} className="rise" style={{ ["--d" as string]: `${80 + i * 50}ms` }}>
              <ExerciseLogger
                exercise={ex}
                index={i}
                sets={log.exercises[i]}
                onChange={(sets) => {
                  setConfirming(false);
                  setLog((l) => ({ ...l, exercises: l.exercises.map((s, j) => (j === i ? sets : s)) }));
                }}
                onSetDone={(sec) => setRest(sec > 0 ? { endsAt: Date.now() + sec * 1000, total: sec } : null)}
              />
            </li>
          ))}
        </ol>

        <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
          <IconShield size={15} className="mt-px shrink-0" />
          {plan.safety_note} Stop if something hurts. Leave weight empty for bodyweight sets.
        </p>
      </div>

      {/* Bottom bar: progress, rest timer and finish */}
      <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl">
        {rest && (
          <div className="pointer-events-none absolute inset-x-0 -top-16 flex justify-center px-4">
            <div className="pointer-events-auto">
              <RestTimer endsAt={rest.endsAt} total={rest.total} onDone={endRest} />
            </div>
          </div>
        )}
        <div className="mx-auto max-w-[880px] space-y-3 px-4 py-3 sm:px-6 lg:px-8">
          {error && (
            <p role="alert" className="flex items-start gap-2 text-sm text-danger">
              <IconAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                {error.message}
                {error.status === 401 && (
                  <>
                    {" "}
                    <SignInLink className="underline" />
                  </>
                )}
              </span>
            </p>
          )}
          {confirming && !error && (
            <p className="text-sm text-muted" aria-live="polite">
              {total - done} set{total - done === 1 ? "" : "s"} not checked off. Only completed sets are saved.
            </p>
          )}
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className="text-xs font-medium tabular text-muted">
                <span className="font-display text-base font-bold text-ink">{done}</span> / {total} sets
              </p>
              <ProgressBar value={total ? done / total : 0} label="Sets completed" />
            </div>
            <Button
              size="lg"
              onClick={finish}
              disabled={done === 0 || submitting}
              aria-busy={submitting || undefined}
              className="shrink-0"
            >
              {submitting ? "Saving…" : confirming ? "Finish anyway" : "Finish workout"}
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export function WorkoutView() {
  const params = useParams<{ day: string }>();
  const [planRes, retry] = useApi(API_ROUTES.planActive, PlanResponseSchema);

  if (planRes.status === "loading") {
    return (
      <Shell>
        <div aria-busy="true" aria-label="Loading workout" className="space-y-6">
          <Skeleton className="h-3 w-40" />
          <Skeleton className="h-14 w-3/5" />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[260px] rounded-lg" />
          ))}
        </div>
      </Shell>
    );
  }

  if (planRes.status === "error") {
    const missing = planRes.error.status === 404;
    const kind = errorKindFromStatus(planRes.error.status);
    return (
      <Shell>
        <Card className="mx-auto max-w-lg">
          {missing ? (
            <EmptyState
              icon={<IconCalendar />}
              title="No plan yet"
              description="Generate your plan first, then log your workouts here."
              action={<ButtonLink href="/onboarding" arrow>Build my plan</ButtonLink>}
            />
          ) : (
            <ErrorState
              kind={kind}
              message={planRes.error.message}
              onRetry={retry}
              action={kind === "auth" ? <SignInButton /> : undefined}
            />
          )}
        </Card>
      </Shell>
    );
  }

  const plan = planRes.data.plan;
  const dayIndex = /^\d+$/.test(params.day ?? "") ? Number(params.day) : -1;
  if (dayIndex < 0 || dayIndex >= plan.days.length) {
    return (
      <Shell>
        <Card className="mx-auto max-w-lg">
          <EmptyState
            icon={<IconCalendar />}
            title="This day isn't in your plan"
            description="Pick a training day from your plan to start a session."
            action={<ButtonLink href="/plan" arrow>Open my plan</ButtonLink>}
          />
        </Card>
      </Shell>
    );
  }

  return <Session key={`${plan.id}-${dayIndex}`} plan={plan} dayIndex={dayIndex} />;
}
