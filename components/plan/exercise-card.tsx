"use client";

import { useId } from "react";
import type { PlanExercise } from "@/lib/contract";
import { formatRest } from "@/lib/client/plan";
import { cx } from "@/components/ui/cx";
import { ExerciseVideo } from "./exercise-video";

/** One spec line: label left, value right. Long values ("8 each side", "30-45 sec") wrap neatly. */
function Spec({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-3">
      <dt className="shrink-0 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">{label}</dt>
      <dd className="min-w-0 text-right font-display text-base font-semibold leading-snug tabular text-ink">{value}</dd>
    </div>
  );
}

/**
 * Expandable exercise row. The video iframe only mounts when the row is open,
 * so a day with 8 exercises doesn't load 8 players.
 */
export function ExerciseCard({
  exercise,
  index,
  open,
  onToggle,
}: {
  exercise: PlanExercise;
  index: number;
  open: boolean;
  onToggle: () => void;
}) {
  const panelId = useId();
  return (
    <li
      className={cx(
        "rounded-lg border transition-colors duration-300",
        open ? "border-line-strong bg-surface" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <h3>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={onToggle}
          className="group flex w-full items-center gap-4 rounded-lg px-4 py-4 text-left sm:px-5"
        >
          <span
            className={cx(
              "grid size-10 shrink-0 place-items-center rounded-md border font-display text-sm font-bold tabular transition-colors",
              open ? "border-lime-line bg-lime-soft text-lime" : "border-line bg-surface-2 text-muted",
            )}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-display text-base font-semibold text-ink sm:text-lg">
              {exercise.name}
            </span>
            <span className="mt-0.5 block text-sm tabular text-muted">
              {exercise.sets} sets × {exercise.reps}
              <span className="px-1.5 text-subtle">·</span>
              {formatRest(exercise.rest_sec)} rest
            </span>
          </span>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className={cx(
              "shrink-0 text-subtle transition-transform duration-300 ease-out-expo group-hover:text-ink",
              open && "rotate-180 text-ink",
            )}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h3>
      <div id={panelId} role="region" aria-label={`${exercise.name} details`} hidden={!open}>
        {open && (
          // minmax(0, …) keeps long content from stretching a column past the card.
          <div className="grid animate-fade grid-cols-1 gap-5 px-4 pb-5 sm:px-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
            <ExerciseVideo youtubeId={exercise.video.youtube_id} title={exercise.video.title} />
            <div className="min-w-0 space-y-4">
              <dl className="divide-y divide-line rounded-md border border-line bg-bg/40">
                <Spec label="Sets" value={exercise.sets} />
                <Spec label="Reps" value={exercise.reps} />
                <Spec label="Rest" value={formatRest(exercise.rest_sec)} />
              </dl>
              {exercise.note && (
                <div className="rounded-md border border-line bg-bg/40 px-4 py-3.5">
                  <p className="flex items-center gap-2 text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-subtle">
                    <span className="h-3 w-0.5 rounded-full bg-lime" aria-hidden="true" />
                    Coach note
                  </p>
                  <p className="mt-1.5 text-[0.9375rem] leading-relaxed text-ink">{exercise.note}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
