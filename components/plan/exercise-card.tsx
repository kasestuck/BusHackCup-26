"use client";

import { useId } from "react";
import type { PlanExercise } from "@/lib/contract";
import { formatRest } from "@/lib/client/plan";
import { cx } from "@/components/ui/cx";
import { ExerciseVideo } from "./exercise-video";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-line bg-bg/40 px-3 py-2.5">
      <dt className="text-[0.6875rem] font-medium uppercase tracking-[0.1em] text-subtle">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-semibold tabular text-ink">{value}</dd>
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
          <div className="rise grid grid-cols-1 gap-5 px-4 pb-5 sm:px-5 lg:grid-cols-[1.35fr_1fr]">
            <ExerciseVideo youtubeId={exercise.video.youtube_id} title={exercise.video.title} />
            <div className="space-y-4">
              <dl className="grid grid-cols-3 gap-2">
                <Stat label="Sets" value={exercise.sets} />
                <Stat label="Reps" value={exercise.reps} />
                <Stat label="Rest" value={formatRest(exercise.rest_sec)} />
              </dl>
              {exercise.note && (
                <div className="border-l-2 border-lime pl-4">
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle">Coach note</p>
                  <p className="mt-1 text-[0.9375rem] leading-relaxed text-ink">{exercise.note}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}
