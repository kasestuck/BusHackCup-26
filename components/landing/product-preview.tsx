import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IconClock, IconCoin, IconDumbbell, IconFlame, IconPlay } from "@/components/ui/icons";

/**
 * Illustrative composition of the real product UI for the hero.
 * Marked as an example — it's marketing art, not anyone's data.
 */
export function ProductPreview() {
  const exercises = [
    ["Goblet Squat", "3 × 8–10"],
    ["Romanian Deadlift", "3 × 8–10"],
    ["Walking Lunge", "3 × 10 each"],
  ];
  return (
    <figure className="relative mx-auto w-full max-w-[460px] lg:max-w-none">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-10 rounded-full bg-lime/10 blur-3xl" />

      <Card tone="feature" className="relative p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <Badge tone="lime" dot>
            Today · Mon
          </Badge>
          <span className="text-xs text-subtle">Day 1 of 3</span>
        </div>
        <p className="mt-5 font-display text-xs font-medium uppercase tracking-[0.14em] text-muted">
          Strength Foundations
        </p>
        <p className="mt-1 font-display text-3xl font-bold tracking-tight text-ink">Lower body</p>
        <div className="mt-4 flex gap-4 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <IconClock size={15} /> 45 min
          </span>
          <span className="inline-flex items-center gap-1.5">
            <IconDumbbell size={15} /> 5 exercises
          </span>
        </div>
        <ol className="mt-5 space-y-2.5">
          {exercises.map(([name, sets], i) => (
            <li key={name} className="flex items-center gap-3 text-[0.9375rem]">
              <span className="w-5 font-display text-xs font-semibold text-subtle">0{i + 1}</span>
              <span className="flex-1 text-ink">{name}</span>
              <span className="text-sm tabular text-muted">{sets}</span>
            </li>
          ))}
        </ol>
        <div className="mt-6 flex h-12 items-center justify-between rounded-md border border-lime-line bg-lime-soft pl-4 pr-1.5 font-display font-semibold text-ink">
          Start session
          <span className="grid size-9 place-items-center rounded-md bg-lime text-lime-ink">
            <IconPlay size={14} />
          </span>
        </div>
      </Card>

      {/* Floating reward moments */}
      <div className="absolute -left-3 top-[58%] hidden rotate-[-3deg] sm:block lg:-left-16">
        <div className="flex items-center gap-3 rounded-lg border border-line-strong bg-surface-2 px-4 py-3 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.9)]">
          <span className="grid size-9 place-items-center rounded-md bg-lime text-lime-ink">
            <IconCoin size={18} />
          </span>
          <div>
            <p className="text-xs text-muted">Checked in at the gym</p>
            <p className="font-display text-lg font-bold leading-tight text-lime">+40 coins</p>
          </div>
        </div>
      </div>
      <div className="absolute -right-2 -top-5 rotate-[4deg] lg:-right-8">
        <div className="flex items-center gap-2 rounded-full border border-line-strong bg-surface-2 px-3.5 py-2 shadow-[0_20px_50px_-15px_rgb(0_0_0/0.9)]">
          <IconFlame size={16} className="text-lime" />
          <span className="font-display text-sm font-bold text-ink">7-day streak</span>
        </div>
      </div>

      <figcaption className="mt-4 text-center text-xs text-subtle">Example plan for illustration</figcaption>
    </figure>
  );
}
