import type { ReactNode } from "react";
import type { MeResponse, Plan } from "@/lib/contract";
import { WEEKDAY_SHORT, formatNumber, type RewardProgress, isoWeekday } from "@/lib/client/dashboard";
import { Card } from "@/components/ui/card";
import { ProgressRing } from "@/components/ui/progress";
import { cx } from "@/components/ui/cx";
import { IconBolt, IconCalendar, IconCoin, IconFlame } from "@/components/ui/icons";

function Metric({
  label,
  icon,
  value,
  unit,
  caption,
  visual,
  accent = false,
  delay,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  unit?: string;
  caption: ReactNode;
  visual?: ReactNode;
  accent?: boolean;
  delay: number;
}) {
  return (
    <Card
      className="rise flex min-h-[176px] flex-col justify-between gap-5 p-4 sm:p-5"
      style={{ ["--d" as string]: `${delay}ms` }}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.8125rem] font-medium text-muted">{label}</p>
        <span className={cx("shrink-0", accent ? "text-lime" : "text-subtle")}>{icon}</span>
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <p className="font-display text-metric font-bold tabular text-ink">
            {value}
            {unit && <span className="ml-1.5 text-base font-medium tracking-normal text-muted">{unit}</span>}
          </p>
          <p className="text-xs leading-snug text-muted sm:text-[0.8125rem]">{caption}</p>
        </div>
        {visual}
      </div>
    </Card>
  );
}

function WeekBars({ plan, today }: { plan: Plan | null; today: Date }) {
  const planned = new Set(plan?.days.map((d) => d.weekday) ?? []);
  const wd = isoWeekday(today);
  return (
    <div className="hidden shrink-0 items-end gap-1 sm:flex" aria-hidden="true">
      {WEEKDAY_SHORT.map((_, i) => {
        const w = i + 1;
        return (
          <span
            key={w}
            className={cx(
              "w-1.5 rounded-full",
              planned.has(w) ? "h-7" : "h-3",
              planned.has(w) ? (w === wd ? "bg-lime" : "bg-ink/70") : "bg-white/10",
            )}
          />
        );
      })}
    </div>
  );
}

export function Metrics({
  me,
  plan,
  today,
  nextReward,
}: {
  me: MeResponse;
  plan: Plan | null;
  today: Date;
  nextReward: RewardProgress | null | "loading";
}) {
  const planned = plan?.days.length ?? 0;
  return (
    <section aria-label="Progress overview" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Metric
        label="Current streak"
        icon={<IconFlame size={18} />}
        accent={me.streak > 0}
        value={formatNumber(me.streak)}
        caption={me.streak > 0 ? "Check in today to keep it alive." : "Check in at a partner gym to start one."}
        delay={160}
      />
      <Metric
        label="Coins balance"
        icon={<IconCoin size={18} />}
        accent
        value={formatNumber(me.coins_balance)}
        caption={
          nextReward && nextReward !== "loading" && !nextReward.affordable
            ? `${formatNumber(nextReward.remaining)} to your next reward`
            : "Earned by showing up."
        }
        delay={220}
      />
      <Metric
        label="Weekly plan"
        icon={<IconCalendar size={18} />}
        value={planned}
        unit={planned === 1 ? "session" : "sessions"}
        caption={plan ? "Scheduled this week." : "No plan yet."}
        visual={<WeekBars plan={plan} today={today} />}
        delay={280}
      />
      <Metric
        label="Next reward"
        icon={<IconBolt size={18} />}
        accent={nextReward !== null && nextReward !== "loading" && nextReward.affordable}
        value={
          nextReward === "loading" ? (
            <span className="text-subtle">—</span>
          ) : nextReward ? (
            `${Math.round(nextReward.progress * 100)}%`
          ) : (
            <span className="text-subtle">—</span>
          )
        }
        caption={
          nextReward === "loading"
            ? "Loading rewards…"
            : nextReward
              ? nextReward.affordable
                ? `Ready: ${nextReward.reward.title}`
                : nextReward.reward.title
              : "Rewards unavailable right now."
        }
        visual={
          nextReward && nextReward !== "loading" ? (
            <ProgressRing value={nextReward.progress} size={52} stroke={4} label="Progress to next reward" />
          ) : undefined
        }
        delay={340}
      />
    </section>
  );
}
