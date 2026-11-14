"use client";

import {
  API_ROUTES,
  MeResponseSchema,
  PlanResponseSchema,
  RewardsResponseSchema,
} from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { useToday } from "@/lib/client/use-today";
import { getNextReward, getNextSession, getTodaySession } from "@/lib/client/dashboard";
import { Card } from "@/components/ui/card";
import { ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconShield } from "@/components/ui/icons";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { Hero } from "./hero";
import { NoPlanCard, TodayCard } from "./today-card";
import { Metrics } from "./metrics";
import { WeekSchedule } from "./week-schedule";
import { RewardsPreview } from "./rewards-preview";
import { EarnStrip } from "./earn-strip";
import { SignInButton } from "@/components/auth/sign-in";

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-16">{children}</div>;
}

export function DashboardView() {
  const today = useToday();
  // Fired in parallel; the shell shares the cached /api/me request.
  const [me, retryMe] = useApi(API_ROUTES.me, MeResponseSchema);
  const [planRes, retryPlan] = useApi(API_ROUTES.planActive, PlanResponseSchema);
  const [rewards, retryRewards] = useApi(API_ROUTES.rewards, RewardsResponseSchema);

  if (!today || me.status === "loading" || planRes.status === "loading") {
    return (
      <Frame>
        <DashboardSkeleton />
      </Frame>
    );
  }

  if (me.status === "error") {
    const kind = errorKindFromStatus(me.error.status);
    return (
      <Frame>
        <Card className="mx-auto max-w-lg">
          <ErrorState
            kind={kind}
            message={kind === "auth" ? "Your dashboard is waiting. Sign in to see your plan, streak and coins." : me.error.message}
            onRetry={retryMe}
            action={kind === "auth" ? <SignInButton /> : undefined}
          />
        </Card>
      </Frame>
    );
  }

  const data = me.data;
  // 404 = no active plan yet (SPEC §6). Any other plan error is shown inline, not as "no plan".
  const planMissing = planRes.status === "error" && planRes.error.status === 404;
  const planFailed = planRes.status === "error" && !planMissing;
  const plan = planRes.status === "success" ? planRes.data.plan : null;

  const todaySession = plan ? getTodaySession(plan, today) : null;
  const nextSession = plan ? getNextSession(plan, today) : null;
  const startTarget = todaySession ?? nextSession;
  const startHref = startTarget ? `/plan?day=${startTarget.dayIndex}` : null;

  const nextReward =
    rewards.status === "loading"
      ? ("loading" as const)
      : rewards.status === "success"
        ? getNextReward(rewards.data.rewards, data.coins_balance)
        : null;

  return (
    <Frame>
      <div className="space-y-10 lg:space-y-12">
        {/* CLARITY — what to do today */}
        <section aria-label="Today" className="grid gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7 lg:py-2">
            <Hero me={data} plan={plan} today={today} startHref={startHref} />
          </div>
          <div className="lg:col-span-5">
            {plan ? (
              <TodayCard plan={plan} today={todaySession} next={nextSession} />
            ) : planFailed ? (
              <Card tone="feature" className="h-full">
                <ErrorState
                  kind={errorKindFromStatus(planRes.error.status)}
                  message={planRes.error.message}
                  onRetry={retryPlan}
                />
              </Card>
            ) : (
              <NoPlanCard me={data} />
            )}
          </div>
        </section>

        {/* MOMENTUM — progress at a glance */}
        <Metrics me={data} plan={plan} today={today} nextReward={nextReward} />

        <div className="grid gap-4 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <WeekSchedule plan={plan} today={today} />
          </div>
          {/* REWARD — what showing up buys */}
          <div className="lg:col-span-4">
            <RewardsPreview rewards={rewards} balance={data.coins_balance} onRetry={retryRewards} />
          </div>
        </div>

        <EarnStrip />

        <footer className="flex items-start gap-3 border-t border-line pt-6 text-xs leading-relaxed text-subtle">
          <IconShield size={16} className="mt-0.5 shrink-0" />
          <p className="max-w-3xl">
            {plan?.safety_note ?? "ShowUp plans are general fitness guidance, not medical advice."} Stop if you feel
            pain, and check with a doctor before starting a new program, especially with an ongoing injury.
          </p>
        </footer>
      </div>
    </Frame>
  );
}
