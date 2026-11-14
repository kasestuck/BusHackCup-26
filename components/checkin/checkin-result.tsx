"use client";

import { useEffect, useRef } from "react";
import type { CheckinResponse, Gym } from "@/lib/contract";
import { formatNumber } from "@/lib/client/dashboard";
import { streakLabel } from "@/lib/client/checkin";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { IconCoin, IconFlame, IconMapPin } from "@/components/ui/icons";

function useFocusHeading() {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => ref.current?.focus(), []);
  return ref;
}

export function CheckinSuccess({ result, gym }: { result: CheckinResponse; gym: Gym | null }) {
  const heading = useFocusHeading();
  return (
    <div className="space-y-10">
      <div className="rise space-y-5">
        <Badge tone="solid">Checked in</Badge>
        <h1 ref={heading} tabIndex={-1} className="font-display text-hero font-bold text-ink outline-none">
          You showed up<span className="text-lime">.</span>
        </h1>
        {gym && (
          <p className="flex items-center gap-2 text-lg text-muted">
            <IconMapPin size={18} className="shrink-0" /> {gym.name} · {gym.address}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card tone="feature" className="rise p-6 sm:col-span-2" style={{ ["--d" as string]: "100ms" }}>
          <p className="flex items-center justify-between text-[0.8125rem] font-medium text-muted">
            Coins earned <IconCoin size={18} className="text-lime" />
          </p>
          <p className="mt-6 font-display text-[clamp(4rem,3rem+5vw,7rem)] font-bold leading-none tracking-[-0.05em] tabular text-lime">
            +{formatNumber(result.coins_earned)}
          </p>
          <p className="mt-3 text-sm text-muted">
            New balance <span className="font-semibold tabular text-ink">{formatNumber(result.balance)}</span> coins
          </p>
        </Card>
        <Card className="rise flex flex-col justify-between p-6" style={{ ["--d" as string]: "180ms" }}>
          <p className="flex items-center justify-between text-[0.8125rem] font-medium text-muted">
            Streak <IconFlame size={18} className="text-lime" />
          </p>
          <p className="mt-6 font-display text-metric font-bold tabular text-ink">{streakLabel(result.streak)}</p>
          <p className="mt-2 text-xs text-muted">Keep showing up to grow it.</p>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/plan" size="lg" arrow>
          Start today&apos;s workout
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary" size="lg">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}

export function AlreadyCheckedIn({ streak, message }: { streak: number | null; message: string }) {
  const heading = useFocusHeading();
  return (
    <div className="rise space-y-8">
      <Badge tone="lime" dot>
        Done for today
      </Badge>
      <h1 ref={heading} tabIndex={-1} className="font-display text-hero font-bold text-ink outline-none">
        Already checked in<span className="text-lime">.</span>
      </h1>
      <p className="max-w-[44ch] text-lg text-muted">{message}</p>
      {streak !== null && (
        <p className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-3 text-ink">
          <IconFlame size={18} className="text-lime" />
          <span className="font-display font-semibold tabular">{streakLabel(streak)}</span>
          <span className="text-muted">streak</span>
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <ButtonLink href="/plan" size="lg" arrow>
          Go to today&apos;s workout
        </ButtonLink>
        <ButtonLink href="/dashboard" variant="secondary" size="lg">
          Back to dashboard
        </ButtonLink>
      </div>
    </div>
  );
}
