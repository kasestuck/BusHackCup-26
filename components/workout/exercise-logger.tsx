"use client";

import { useState } from "react";
import type { PlanExercise } from "@/lib/contract";
import { formatRest } from "@/lib/client/plan";
import { parseTargetReps, setError, type SetLog } from "@/lib/client/workout";
import { Card } from "@/components/ui/card";
import { cx } from "@/components/ui/cx";
import { ExerciseVideo } from "@/components/plan/exercise-video";

function Field({
  label,
  value,
  onChange,
  placeholder,
  suffix,
  inputMode,
  invalid,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  suffix: string;
  inputMode: "numeric" | "decimal";
  invalid: boolean;
  disabled: boolean;
}) {
  return (
    <label
      className={cx(
        "flex h-11 min-w-0 items-center rounded-md border bg-bg/50 transition-colors focus-within:border-lime",
        invalid ? "border-danger/60" : "border-line-strong",
        disabled && "opacity-60",
      )}
    >
      <span className="sr-only">{label}</span>
      <input
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
        className="h-full w-full min-w-0 bg-transparent pl-3 font-display text-base font-semibold tabular text-ink outline-none placeholder:font-sans placeholder:font-normal placeholder:text-subtle disabled:cursor-not-allowed"
      />
      <span className="pr-3 text-xs text-muted">{suffix}</span>
    </label>
  );
}

export function ExerciseLogger({
  exercise,
  index,
  sets,
  onChange,
  onSetDone,
}: {
  exercise: PlanExercise;
  index: number;
  sets: SetLog[];
  onChange: (sets: SetLog[]) => void;
  /** Fired when a set is checked off, to start the rest timer. */
  onSetDone: (restSec: number) => void;
}) {
  const [showVideo, setShowVideo] = useState(false);
  const [tried, setTried] = useState<Set<number>>(new Set());
  const target = parseTargetReps(exercise.reps);
  const doneCount = sets.filter((s) => s.done).length;
  const complete = doneCount === sets.length;

  const update = (i: number, patch: Partial<SetLog>) =>
    onChange(sets.map((s, j) => (j === i ? { ...s, ...patch } : s)));

  const toggleDone = (i: number) => {
    const s = sets[i];
    if (s.done) {
      update(i, { done: false });
      return;
    }
    // Empty reps → use the target as a sensible default before validating.
    const filled = { ...s, reps: s.reps.trim() === "" && target.value ? String(target.value) : s.reps };
    if (setError(filled)) {
      setTried((t) => new Set(t).add(i));
      update(i, filled);
      return;
    }
    const next = sets.map((x, j) => (j === i ? { ...filled, done: true } : x));
    // Carry the weight forward to the next empty set — the common case at the gym.
    if (next[i + 1] && next[i + 1].weightLb === "" && filled.weightLb !== "") {
      next[i + 1] = { ...next[i + 1], weightLb: filled.weightLb };
    }
    onChange(next);
    onSetDone(exercise.rest_sec);
  };

  return (
    <Card className={cx("overflow-hidden", complete && "border-lime-line")}>
      <div className="flex items-start gap-4 p-4 sm:p-5">
        <span
          className={cx(
            "grid size-10 shrink-0 place-items-center rounded-md border font-display text-sm font-bold tabular transition-colors",
            complete ? "border-lime bg-lime text-lime-ink" : "border-line bg-surface-2 text-muted",
          )}
          aria-hidden="true"
        >
          {complete ? "✓" : String(index + 1).padStart(2, "0")}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-semibold text-ink">{exercise.name}</h3>
          <p className="mt-0.5 text-sm tabular text-muted">
            Target {exercise.sets} × {exercise.reps}
            <span className="px-1.5 text-subtle">·</span>
            {formatRest(exercise.rest_sec)} rest
          </p>
          {exercise.note && <p className="mt-2 text-sm leading-relaxed text-subtle">{exercise.note}</p>}
        </div>
        <span className="shrink-0 pt-1 text-xs font-medium tabular text-muted">
          {doneCount}/{sets.length}
        </span>
      </div>

      <div className="px-4 sm:px-5">
        <button
          type="button"
          onClick={() => setShowVideo((v) => !v)}
          aria-expanded={showVideo}
          className="-mt-1 mb-3 inline-flex h-9 items-center gap-1.5 rounded-sm text-sm font-medium text-lime"
        >
          {showVideo ? "Hide technique" : "Watch technique"}
        </button>
        {showVideo && (
          <div className="mb-4 max-w-xl">
            <ExerciseVideo youtubeId={exercise.video.youtube_id} title={exercise.video.title} />
          </div>
        )}
      </div>

      <div className="border-t border-line bg-bg/30 px-4 py-3 sm:px-5">
        <div className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 pb-2 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-subtle sm:gap-3">
          <span>Set</span>
          <span>Weight</span>
          <span>{target.unit === "sec" ? "Time" : "Reps"}</span>
          <span className="sr-only">Done</span>
        </div>
        <ol className="space-y-2">
          {sets.map((s, i) => {
            const err = tried.has(i) && !s.done ? setError(s) : null;
            return (
              <li key={i} className="grid grid-cols-[2rem_1fr_1fr_2.75rem] items-center gap-2 sm:gap-3">
                <span className={cx("font-display text-sm font-bold tabular", s.done ? "text-lime" : "text-muted")}>
                  {i + 1}
                </span>
                <Field
                  label={`${exercise.name} set ${i + 1} weight in pounds`}
                  value={s.weightLb}
                  onChange={(v) => update(i, { weightLb: v })}
                  placeholder="BW"
                  suffix="lb"
                  inputMode="decimal"
                  invalid={err === "weight"}
                  disabled={s.done}
                />
                <Field
                  label={`${exercise.name} set ${i + 1} ${target.unit === "sec" ? "seconds" : "reps"}`}
                  value={s.reps}
                  onChange={(v) => update(i, { reps: v })}
                  placeholder={target.value ? String(target.value) : "—"}
                  suffix={target.unit === "sec" ? "sec" : "reps"}
                  inputMode="numeric"
                  invalid={err === "reps"}
                  disabled={s.done}
                />
                <button
                  type="button"
                  onClick={() => toggleDone(i)}
                  aria-pressed={s.done}
                  aria-label={`${s.done ? "Undo" : "Complete"} ${exercise.name} set ${i + 1}`}
                  className={cx(
                    "grid size-11 place-items-center rounded-md border transition-[background-color,border-color,transform] duration-200 active:scale-90",
                    s.done
                      ? "border-lime bg-lime text-lime-ink"
                      : "border-line-strong bg-surface-2 text-muted hover:border-lime-line hover:text-lime",
                  )}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 12.5 10 17.5 19 7" />
                  </svg>
                </button>
                {err && (
                  <p role="alert" className="col-span-4 -mt-1 pl-10 text-xs font-medium text-danger">
                    {err === "reps" ? `Enter ${target.unit === "sec" ? "seconds" : "reps"} as a whole number.` : "Weight must be a number (leave empty for bodyweight)."}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
        <div className="flex gap-1 pt-2">
          <button
            type="button"
            onClick={() => onChange([...sets, { weightLb: sets[sets.length - 1]?.weightLb ?? "", reps: "", done: false }])}
            className="inline-flex h-10 items-center rounded-sm px-2 text-sm font-medium text-muted transition-colors hover:text-ink"
          >
            + Add set
          </button>
          {sets.length > 1 && !sets[sets.length - 1].done && (
            <button
              type="button"
              onClick={() => onChange(sets.slice(0, -1))}
              className="inline-flex h-10 items-center rounded-sm px-2 text-sm font-medium text-subtle transition-colors hover:text-ink"
            >
              Remove last
            </button>
          )}
        </div>
      </div>
    </Card>
  );
}
