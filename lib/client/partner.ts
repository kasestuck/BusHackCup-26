/**
 * Partner panel math (SPEC §7 "Partner commission"). Pure — runs under `node --test`.
 * All money arrives in integer cents and is displayed in USD.
 */
import type { PartnerStatsResponse } from "@/lib/contract";

export function formatCents(cents: number, opts: { compact?: boolean } = {}): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts.compact && Math.abs(cents) >= 1_000_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
    minimumFractionDigits: opts.compact && Math.abs(cents) >= 1_000_000 ? 0 : 2,
  }).format(cents / 100);
}

export type PartnerDerived = {
  /** Average order value in cents, null with no sales. */
  aovCents: number | null;
  /** Effective commission rate 0–100, null with no revenue. */
  ratePct: number | null;
  /** What the partner keeps after commission, in cents. */
  netCents: number;
};

export function derivePartnerStats(s: PartnerStatsResponse): PartnerDerived {
  return {
    aovCents: s.sales_count > 0 ? Math.round(s.revenue_cents / s.sales_count) : null,
    ratePct: s.revenue_cents > 0 ? Math.round((s.commission_cents / s.revenue_cents) * 1000) / 10 : null,
    netCents: s.revenue_cents - s.commission_cents,
  };
}
