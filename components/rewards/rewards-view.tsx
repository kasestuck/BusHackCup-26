"use client";

import Link from "next/link";
import { useState } from "react";
import { API_ROUTES, MeResponseSchema, RewardsResponseSchema, type Reward } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { formatNumber } from "@/lib/client/dashboard";
import { affordability, sortRewards } from "@/lib/client/rewards";
import { EARN_RULES } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ProgressBar } from "@/components/ui/progress";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconCoin, IconGift, IconLock } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { PRO_FEATURES } from "./pro-features";
import { RedeemDialog } from "./redeem-dialog";

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1240px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">{children}</div>;
}

function RedeemButton({ reward, balance, onRedeem }: { reward: Reward; balance: number; onRedeem: () => void }) {
  const a = affordability(reward, balance);
  if (!a.affordable) {
    return (
      <Button variant="secondary" disabled className="w-full" icon={<IconLock size={16} />}>
        {formatNumber(a.remaining)} more coins
      </Button>
    );
  }
  return (
    <Button onClick={onRedeem} className="w-full" icon={<IconCoin size={18} />}>
      Redeem
    </Button>
  );
}

function ProCard({
  reward,
  balance,
  isPro,
  onRedeem,
}: {
  reward: Reward;
  balance: number;
  isPro: boolean;
  onRedeem: () => void;
}) {
  const a = affordability(reward, balance);
  return (
    <Card tone="feature" className="rise grain overflow-hidden p-6 sm:p-8" style={{ ["--d" as string]: "120ms" }}>
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-end">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="solid">PRO</Badge>
            {isPro && <Badge tone="lime">You&apos;re Pro · redeeming adds 30 days</Badge>}
          </div>
          <h2 className="font-display text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-[1] tracking-[-0.03em] text-ink">
            {reward.title}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            {PRO_FEATURES.map((f) => (
              <li key={f.title} className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <span className="size-1.5 rounded-full bg-lime" aria-hidden="true" />
                  {f.title}
                </p>
                <p className="pl-3.5 text-xs text-muted">{f.detail}</p>
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-4 rounded-lg border border-line bg-bg/50 p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="flex items-baseline gap-2">
              <span className="font-display text-metric font-bold tabular text-ink">{formatNumber(reward.cost_coins)}</span>
              <span className="text-sm text-muted">coins</span>
            </p>
            <span className="text-sm tabular text-muted">{Math.round(a.progress * 100)}%</span>
          </div>
          <ProgressBar value={a.progress} label={`Progress to ${reward.title}`} />
          <p className="text-xs text-muted">
            {a.affordable
              ? "You can redeem this now."
              : `${formatNumber(a.remaining)} coins to go.`}
          </p>
          <RedeemButton reward={reward} balance={balance} onRedeem={onRedeem} />
        </div>
      </div>
    </Card>
  );
}

function PartnerCard({
  reward,
  balance,
  index,
  onRedeem,
}: {
  reward: Reward;
  balance: number;
  index: number;
  onRedeem: () => void;
}) {
  const a = affordability(reward, balance);
  return (
    <Card
      interactive
      className={cx("rise flex h-full flex-col gap-6 p-5 sm:p-6", a.affordable && "border-lime-line")}
      style={{ ["--d" as string]: `${200 + index * 60}ms` }}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-[3.25rem] font-bold leading-none tracking-[-0.05em] tabular text-ink">
          {reward.discount_pct ? (
            <>
              {reward.discount_pct}
              <span className="text-lime">%</span>
            </>
          ) : (
            <IconGift size={40} className="text-lime" />
          )}
        </p>
        {a.affordable ? <Badge tone="solid">Ready</Badge> : <Badge>Partner</Badge>}
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold text-ink">{reward.title}</h3>
        <p className="text-sm text-muted">Unique promo code for the partner&apos;s store.</p>
      </div>
      <div className="mt-auto space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="inline-flex items-center gap-1.5 font-display font-semibold tabular text-ink">
            <IconCoin size={16} className="text-lime" />
            {formatNumber(reward.cost_coins)}
          </span>
          {!a.affordable && <span className="text-xs tabular text-muted">{Math.round(a.progress * 100)}%</span>}
        </div>
        {!a.affordable && <ProgressBar value={a.progress} label={`Progress to ${reward.title}`} tone="muted" />}
        <RedeemButton reward={reward} balance={balance} onRedeem={onRedeem} />
      </div>
    </Card>
  );
}

function Loading() {
  return (
    <div aria-busy="true" aria-label="Loading rewards" className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-16 w-4/5" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <Skeleton className="h-[160px] rounded-lg lg:col-span-5" />
      </div>
      <Skeleton className="h-[300px] rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-[300px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function RewardsView() {
  const [me, retryMe] = useApi(API_ROUTES.me, MeResponseSchema);
  const [rewards, retryRewards] = useApi(API_ROUTES.rewards, RewardsResponseSchema);
  const [selected, setSelected] = useState<Reward | null>(null);

  if (me.status === "loading" || rewards.status === "loading") {
    return (
      <Frame>
        <Loading />
      </Frame>
    );
  }

  const failed = me.status === "error" ? { e: me.error, retry: retryMe } : rewards.status === "error" ? { e: rewards.error, retry: retryRewards } : null;
  if (failed) {
    const kind = errorKindFromStatus(failed.e.status);
    return (
      <Frame>
        <Card className="mx-auto max-w-lg">
          <ErrorState
            kind={kind}
            message={failed.e.message}
            onRetry={failed.retry}
            action={kind === "auth" ? <ButtonLink href="/login" arrow>Sign in</ButtonLink> : undefined}
          />
        </Card>
      </Frame>
    );
  }
  if (me.status !== "success" || rewards.status !== "success") return null;

  const balance = me.data.coins_balance;
  const list = sortRewards(rewards.data.rewards);
  const pro = list.find((r) => r.kind === "pro_month");
  const partners = list.filter((r) => r.kind === "partner_product");
  const checkin = EARN_RULES.find((r) => r.key === "checkin")!;
  const session = EARN_RULES.find((r) => r.key === "session")!;

  return (
    <Frame>
      <div className="space-y-10 lg:space-y-12">
        <header className="rise grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="space-y-4 lg:col-span-7">
            <Eyebrow>Rewards</Eyebrow>
            <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
              Spend what you earned<span className="text-lime">.</span>
            </h1>
            <p className="max-w-[46ch] text-lg text-muted">
              Every coin here came from showing up. Trade them for Pro or partner discounts.
            </p>
          </div>
          <Card className="p-5 sm:p-6 lg:col-span-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
              <IconCoin size={15} className="text-lime" /> Your balance
            </p>
            <p className="mt-2 font-display text-[clamp(2.75rem,2rem+2.5vw,3.75rem)] font-bold leading-none tracking-[-0.04em] tabular text-ink">
              {formatNumber(balance)}
            </p>
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <Link href="/checkin" className="-my-2 py-2 hover:text-ink">
                <span className="font-semibold text-lime">+{checkin.coins}</span> gym check-in →
              </Link>
              <Link href="/plan" className="-my-2 py-2 hover:text-ink">
                <span className="font-semibold text-lime">+{session.coins}</span> logged workout →
              </Link>
            </p>
          </Card>
        </header>

        {list.length === 0 ? (
          <Card>
            <EmptyState
              icon={<IconGift />}
              title="Rewards are on the way"
              description="Keep earning. Partner rewards land here as they go live, and your coins wait for you."
            />
          </Card>
        ) : (
          <>
            {pro && <ProCard reward={pro} balance={balance} isPro={me.data.is_pro} onRedeem={() => setSelected(pro)} />}
            {partners.length > 0 && (
              <section aria-labelledby="partner-heading" className="space-y-5">
                <div className="space-y-1.5">
                  <Eyebrow>Partner rewards</Eyebrow>
                  <h2 id="partner-heading" className="font-display text-2xl font-semibold tracking-tight text-ink">
                    Discounts on sports nutrition
                  </h2>
                </div>
                <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {partners.map((r, i) => (
                    <li key={r.id}>
                      <PartnerCard reward={r} balance={balance} index={i} onRedeem={() => setSelected(r)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}

        <p className="border-t border-line pt-6 text-xs leading-relaxed text-subtle">
          Coins are deducted the moment you redeem. Copy your promo code right away and use it at checkout in the
          partner&apos;s store.
        </p>
      </div>

      <RedeemDialog reward={selected} balance={balance} onClose={() => setSelected(null)} />
    </Frame>
  );
}
