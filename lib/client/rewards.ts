/**
 * Coin store helpers (SPEC §7 "Coin store"). Type-only imports — runs under `node --test`.
 */
import type { Reward } from "@/lib/contract";

/** Active rewards: Pro first (the headline reward), then cheapest first. */
export function sortRewards(rewards: Reward[]): Reward[] {
  return rewards
    .filter((r) => r.active)
    .sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "pro_month" ? -1 : 1;
      return a.cost_coins - b.cost_coins;
    });
}

export type Affordability = { affordable: boolean; remaining: number; progress: number; balanceAfter: number };

export function affordability(reward: Reward, balance: number): Affordability {
  const remaining = Math.max(0, reward.cost_coins - balance);
  return {
    affordable: remaining === 0,
    remaining,
    progress: reward.cost_coins > 0 ? Math.min(1, balance / reward.cost_coins) : 1,
    balanceAfter: balance - reward.cost_coins,
  };
}

/** ISO timestamp → "December 14, 2026" in the viewer's locale-neutral US format. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(d);
}
