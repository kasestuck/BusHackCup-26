"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { API_ROUTES, PartnerStatsResponseSchema } from "@/lib/contract";
import { invalidateApi, useApi } from "@/lib/client/use-api";
import { USE_MOCKS } from "@/lib/client/mocks";
import { formatNumber } from "@/lib/client/dashboard";
import { derivePartnerStats, formatCents } from "@/lib/client/partner";
import { LogoMark } from "@/components/brand/wordmark";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconCoin, IconGift, IconMapPin, IconRefresh } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { SignInButton } from "@/components/auth/sign-in";

const REFRESH_MS = 60_000;

const FLOW = [
  { icon: <IconMapPin size={18} />, title: "Members show up", body: "They earn coins for verified gym visits and logged workouts." },
  { icon: <IconCoin size={18} />, title: "They redeem coins", body: "Coins become a unique promo code for your store." },
  { icon: <IconGift size={18} />, title: "They buy from you", body: "Orders with a ShowUp code appear here with the commission due." },
];

function Kpi({
  label,
  value,
  sub,
  hero = false,
  delay,
}: {
  label: string;
  value: string;
  sub?: string;
  hero?: boolean;
  delay: number;
}) {
  return (
    <Card
      tone={hero ? "feature" : "default"}
      className={cx("rise flex flex-col justify-between gap-6 p-5 sm:p-6", hero && "sm:col-span-2 lg:col-span-1 lg:row-span-2")}
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
      <div>
        <p
          className={cx(
            "font-display font-bold tabular tracking-[-0.04em]",
            hero ? "text-[clamp(3rem,2.2rem+3.4vw,4.75rem)] leading-none text-lime" : "text-metric text-ink",
          )}
        >
          {value}
        </p>
        {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
      </div>
    </Card>
  );
}

function Stats({ partnerId }: { partnerId: string }) {
  const path = API_ROUTES.partnerStats(partnerId);
  const [stats, retry] = useApi(path, PartnerStatsResponseSchema);

  // Keep the panel live during the demo: quiet background refresh while the tab is visible.
  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") invalidateApi(path);
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [path]);

  if (stats.status === "loading") {
    return (
      <div aria-busy="true" aria-label="Loading partner stats" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-[260px] rounded-lg lg:row-span-2" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (stats.status === "error") {
    const notFound = stats.error.status === 404;
    const kind = errorKindFromStatus(stats.error.status);
    return (
      <Card className="mx-auto max-w-lg">
        {notFound ? (
          <EmptyState
            title="Partner not found"
            description="Check the link you were given. Each partner has its own dashboard address."
          />
        ) : (
          <ErrorState
            kind={kind}
            message={stats.error.message}
            onRetry={retry}
            action={kind === "auth" ? <SignInButton /> : undefined}
          />
        )}
      </Card>
    );
  }

  const s = stats.data;
  const d = derivePartnerStats(s);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-lime" aria-hidden="true" />
          Live · refreshes every minute
        </p>
        <Button variant="ghost" className="h-10 text-sm" onClick={() => invalidateApi(path)} icon={<IconRefresh size={16} />}>
          Refresh now
        </Button>
      </div>

      {s.sales_count === 0 ? (
        <Card>
          <EmptyState
            icon={<IconGift />}
            title="No sales yet"
            description="Orders placed with a ShowUp promo code show up here, together with the commission due."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Kpi
            hero
            label="Commission due to ShowUp"
            value={formatCents(s.commission_cents)}
            sub={d.ratePct !== null ? `${d.ratePct}% of revenue from ShowUp codes` : undefined}
            delay={80}
          />
          <Kpi label="Revenue from ShowUp codes" value={formatCents(s.revenue_cents)} delay={140} />
          <Kpi label="Orders" value={formatNumber(s.sales_count)} sub="Placed with a ShowUp promo code" delay={200} />
          <Kpi
            label="Average order"
            value={d.aovCents !== null ? formatCents(d.aovCents) : "—"}
            delay={260}
          />
          <Kpi label="You keep" value={formatCents(d.netCents)} sub="Revenue after commission" delay={320} />
        </div>
      )}
    </div>
  );
}

export function PartnerView() {
  const params = useParams<{ id: string }>();
  const partnerId = decodeURIComponent(params.id ?? "");

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-[-0.04em] text-ink">
            Show<span className="text-lime">Up</span>
          </span>
          <span className="text-sm text-subtle">· Partners</span>
          {USE_MOCKS && (
            <span className="ml-auto inline-flex h-6 items-center rounded-sm border border-warning/30 bg-warning-soft px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-warning">
              Mock data
            </span>
          )}
        </div>
      </header>

      <main id="main" className="mx-auto max-w-[1240px] space-y-12 px-4 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
        <header className="rise space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Eyebrow>Partner dashboard</Eyebrow>
            <Badge>Demo</Badge>
          </div>
          <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
            Sales from ShowUp members<span className="text-lime">.</span>
          </h1>
          <p className="max-w-[52ch] text-lg text-muted">
            Every order here came from someone who earned their discount by showing up at the gym.
          </p>
          <p className="text-xs text-subtle">
            Partner ID <code className="rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-muted">{partnerId}</code>
          </p>
        </header>

        <Stats partnerId={partnerId} />

        <section aria-labelledby="flow-heading" className="space-y-5">
          <h2 id="flow-heading" className="font-display text-xl font-semibold text-ink">
            How sales reach you
          </h2>
          <ol className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
            {FLOW.map((f, i) => (
              <li key={f.title} className="flex gap-4 bg-bg p-5 sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
                  {f.icon}
                </span>
                <div>
                  <p className="font-display font-semibold text-ink">
                    <span className="mr-2 text-subtle tabular">0{i + 1}</span>
                    {f.title}
                  </p>
                  <p className="mt-1 text-sm text-muted">{f.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="text-xs text-subtle">
            Store purchases are simulated in this demo; sales and commission are calculated exactly as they would be
            for real orders.
          </p>
        </section>
      </main>
    </div>
  );
}
