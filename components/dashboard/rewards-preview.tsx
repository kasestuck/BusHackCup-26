import type { Reward, RewardsResponse } from "@/lib/contract";
import type { ApiState } from "@/lib/client/use-api";
import { formatNumber, getNextReward } from "@/lib/client/dashboard";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ProgressBar } from "@/components/ui/progress";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { ButtonLink } from "@/components/ui/button";
import { cx } from "@/components/ui/cx";
import { IconCoin, IconGift, IconLock } from "@/components/ui/icons";

function RewardRow({ reward, balance }: { reward: Reward; balance: number }) {
  const ready = balance >= reward.cost_coins;
  return (
    <li className="flex items-center gap-3.5 py-3.5">
      <div
        className={cx(
          "grid size-11 shrink-0 place-items-center rounded-md border font-display text-sm font-bold",
          ready ? "border-lime-line bg-lime-soft text-lime" : "border-line bg-surface-2 text-muted",
        )}
        aria-hidden="true"
      >
        {reward.kind === "pro_month" ? "PRO" : reward.discount_pct ? `${reward.discount_pct}%` : <IconGift size={18} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[0.9375rem] font-medium text-ink">{reward.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs tabular text-muted">
          <IconCoin size={13} className={ready ? "text-lime" : ""} />
          {formatNumber(reward.cost_coins)} coins
        </p>
      </div>
      {ready ? (
        <span className="shrink-0 rounded-sm bg-lime px-2 py-1 text-[0.6875rem] font-bold uppercase tracking-wider text-lime-ink">
          Ready
        </span>
      ) : (
        <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular text-subtle">
          <IconLock size={13} />
          {formatNumber(reward.cost_coins - balance)} to go
        </span>
      )}
    </li>
  );
}

export function RewardsPreview({
  rewards,
  balance,
  onRetry,
}: {
  rewards: ApiState<RewardsResponse>;
  balance: number;
  onRetry: () => void;
}) {
  const list =
    rewards.status === "success"
      ? rewards.data.rewards.filter((r) => r.active).sort((a, b) => a.cost_coins - b.cost_coins)
      : [];
  const next = getNextReward(list, balance);

  return (
    <Card className="rise flex h-full flex-col p-5 sm:p-6" style={{ ["--d" as string]: "440ms" }}>
      <SectionHeader eyebrow="Rewards" title="Your coins" href="/rewards" linkLabel="Marketplace" />

      <div className="mt-5 flex items-baseline gap-2">
        <IconCoin size={26} className="translate-y-0.5 self-center text-lime" />
        <span className="font-display text-metric font-bold tabular text-ink">{formatNumber(balance)}</span>
        <span className="text-sm text-muted">available</span>
      </div>

      {next && (
        <div className="mt-4 space-y-2">
          <ProgressBar value={next.progress} label={`Progress to ${next.reward.title}`} />
          <p className="text-xs text-muted">
            {next.affordable
              ? `You can redeem ${next.reward.title} now.`
              : `${formatNumber(next.remaining)} coins to ${next.reward.title}`}
          </p>
        </div>
      )}

      <div className="mt-3 flex-1">
        {rewards.status === "loading" && (
          <div aria-busy="true" aria-label="Loading rewards" className="space-y-4 pt-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3.5">
                <Skeleton className="size-11 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        )}
        {rewards.status === "error" && (
          <ErrorState
            compact
            kind={errorKindFromStatus(rewards.error.status)}
            message={rewards.error.message}
            onRetry={onRetry}
          />
        )}
        {rewards.status === "success" &&
          (list.length === 0 ? (
            <EmptyState
              compact
              icon={<IconGift />}
              title="Rewards are on the way"
              description="Keep earning. New partner rewards land here soon."
            />
          ) : (
            <ul className="divide-y divide-line" aria-label="Rewards">
              {list.slice(0, 3).map((r) => (
                <RewardRow key={r.id} reward={r} balance={balance} />
              ))}
            </ul>
          ))}
      </div>

      <ButtonLink href="/rewards" variant="secondary" className="mt-4 w-full" arrow>
        Browse rewards
      </ButtonLink>
    </Card>
  );
}
