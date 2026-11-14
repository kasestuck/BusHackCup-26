"use client";

import { API_ROUTES, MeResponseSchema, RewardsResponseSchema } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { formatNumber } from "@/lib/client/dashboard";
import { formatUsd } from "@/lib/client/checkout";
import { affordability } from "@/lib/client/rewards";
import { PRO_PRICE_USD } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconCoin } from "@/components/ui/icons";
import { PlanComparison } from "./plan-comparison";
import { SignInButton } from "@/components/auth/sign-in";

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-16">{children}</div>;
}

/** Second way to Pro: earn it with coins (SPEC §7 coin store). */
function EarnItCard({ balance }: { balance: number }) {
  const [rewards] = useApi(API_ROUTES.rewards, RewardsResponseSchema);
  if (rewards.status === "loading") return <Skeleton className="h-[150px] rounded-lg" />;
  if (rewards.status === "error") return null;
  const pro = rewards.data.rewards.find((r) => r.kind === "pro_month" && r.active);
  if (!pro) return null;
  const a = affordability(pro, balance);
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display font-semibold text-ink">Or earn it by showing up</p>
          <p className="mt-1 text-sm text-muted">
            A month of Pro costs {formatNumber(pro.cost_coins)} coins in Rewards.
          </p>
        </div>
        <IconCoin className="shrink-0 text-lime" />
      </div>
      <ProgressBar value={a.progress} label="Coins toward a free month of Pro" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm tabular text-muted">
          <span className="font-semibold text-ink">{formatNumber(Math.min(balance, pro.cost_coins))}</span> /{" "}
          {formatNumber(pro.cost_coins)} coins
        </p>
        <ButtonLink href="/rewards" variant="secondary" className="h-10 text-sm" arrow>
          {a.affordable ? "Redeem with coins" : "View rewards"}
        </ButtonLink>
      </div>
    </Card>
  );
}

export function PaywallView() {
  const [me, retry] = useApi(API_ROUTES.me, MeResponseSchema);

  if (me.status === "loading") {
    return (
      <Frame>
        <div aria-busy="true" aria-label="Loading" className="grid gap-10 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-6">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-20 w-4/5" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-28 w-1/2" />
          </div>
          <Skeleton className="h-[360px] rounded-lg lg:col-span-6" />
        </div>
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
            message={me.error.message}
            onRetry={retry}
            action={kind === "auth" ? <SignInButton /> : undefined}
          />
        </Card>
      </Frame>
    );
  }

  const isPro = me.data.is_pro;
  return (
    <Frame>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="rise space-y-8 lg:col-span-6">
          <div className="space-y-5">
            <Eyebrow>ShowUp Pro</Eyebrow>
            <h1 className="font-display text-hero font-bold text-ink">
              You show up.
              <br />
              Pro does more<span className="text-lime">.</span>
            </h1>
            <p className="max-w-[40ch] text-lg text-muted">
              More AI plans, nutrition analysis from a photo and extended stats, on top of everything in Free.
            </p>
          </div>

          {isPro ? (
            <div className="space-y-5">
              <Badge tone="solid">You&apos;re Pro</Badge>
              <p className="text-muted">Everything on this page is already unlocked for you.</p>
              <ButtonLink href="/dashboard" size="lg" arrow>
                Back to dashboard
              </ButtonLink>
            </div>
          ) : (
            <div className="space-y-6">
              <p className="flex items-baseline gap-2">
                <span className="font-display text-[clamp(3.5rem,2.8rem+3vw,5rem)] font-bold leading-none tracking-[-0.05em] tabular text-ink">
                  {formatUsd(PRO_PRICE_USD)}
                </span>
                <span className="text-lg text-muted">/ month</span>
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href="/checkout" size="lg" arrow>
                  Continue to checkout
                </ButtonLink>
                <p className="text-sm text-subtle">Demo billing: no real charge.</p>
              </div>
              <EarnItCard balance={me.data.coins_balance} />
            </div>
          )}
        </div>

        <div className="rise lg:col-span-6 lg:pt-6" style={{ ["--d" as string]: "120ms" }}>
          <Card className="p-5 sm:p-7">
            <PlanComparison />
          </Card>
        </div>
      </div>
    </Frame>
  );
}
