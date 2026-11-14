"use client";

import { useEffect, useRef } from "react";
import type { SessionResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/client/dashboard";
import { formatElapsed } from "@/lib/client/workout";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconBolt, IconCoin } from "@/components/ui/icons";
import { EARN_RULES } from "@/lib/client/economy";

export function SessionResult({
  result,
  focus,
  sets,
  elapsedSec,
}: {
  result: SessionResponse;
  focus: string;
  sets: number;
  elapsedSec: number;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  const checkin = EARN_RULES.find((r) => r.key === "checkin")!;

  const stats = [
    { label: "XP earned", value: `+${formatNumber(result.xp_earned)}`, icon: <IconBolt size={18} />, accent: true },
    {
      label: "Coins earned",
      value: `+${formatNumber(result.coins_earned)}`,
      icon: <IconCoin size={18} />,
      accent: result.coins_earned > 0,
    },
    { label: "Balance", value: formatNumber(result.balance), icon: <IconCoin size={18} />, accent: false },
  ];

  return (
    <div className="space-y-10">
      <div className="rise space-y-5">
        <Badge tone="solid">Workout logged</Badge>
        <h1 ref={heading} tabIndex={-1} className="font-display text-hero font-bold text-ink outline-none">
          You showed up<span className="text-lime">.</span>
        </h1>
        <p className="text-lg text-muted">
          {focus} · {sets} {sets === 1 ? "set" : "sets"} · {formatElapsed(elapsedSec)}
        </p>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {stats.map((s, i) => (
          <Card key={s.label} className="rise p-5" style={{ ["--d" as string]: `${120 + i * 80}ms` }}>
            <dt className="flex items-center justify-between text-[0.8125rem] font-medium text-muted">
              {s.label}
              <span className={s.accent ? "text-lime" : "text-subtle"}>{s.icon}</span>
            </dt>
            <dd className={`mt-4 font-display text-metric font-bold tabular ${s.accent ? "text-lime" : "text-ink"}`}>
              {s.value}
            </dd>
          </Card>
        ))}
      </dl>

      {result.coins_earned === 0 && (
        <p className="rise rounded-md border border-line bg-surface px-4 py-3 text-sm text-muted">
          Workout coins are paid once a day, and today&apos;s are already yours. Your XP still counts.
        </p>
      )}

      <Card className="rise flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between" style={{ ["--d" as string]: "380ms" }}>
        <div>
          <p className="font-display text-lg font-semibold text-ink">Trained at a partner gym?</p>
          <p className="mt-1 text-sm text-muted">
            {checkin.title} for <span className="font-semibold text-lime">+{checkin.coins} coins</span>. Once a day.
          </p>
        </div>
        <span className="text-xs text-subtle">Gym check-in arrives in a later build phase.</span>
      </Card>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/dashboard" size="lg" arrow>
          Back to dashboard
        </ButtonLink>
        <ButtonLink href="/plan" variant="secondary" size="lg">
          View my plan
        </ButtonLink>
      </div>
    </div>
  );
}
