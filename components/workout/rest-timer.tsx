"use client";

import { useEffect, useState } from "react";
import { formatElapsed } from "@/lib/client/workout";

/** Countdown shown after a set is completed. `endsAt` is a ms timestamp. */
export function RestTimer({ endsAt, total, onDone }: { endsAt: number; total: number; onDone: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  useEffect(() => {
    if (left === 0) onDone();
  }, [left, onDone]);

  const progress = total > 0 ? 1 - left / total : 1;
  return (
    <div className="flex items-center gap-3 rounded-md border border-lime-line bg-surface px-3 py-2 shadow-[0_12px_40px_-12px_rgb(0_0_0/0.8)]">
      <div className="relative size-9 shrink-0" aria-hidden="true">
        <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
          <circle cx="18" cy="18" r="15" fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15"
            fill="none"
            stroke="var(--su-lime)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={2 * Math.PI * 15}
            strokeDashoffset={2 * Math.PI * 15 * progress}
          />
        </svg>
      </div>
      <div className="min-w-0">
        <p className="text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-muted">Rest</p>
        <p className="font-display text-lg font-bold leading-none tabular text-ink">{formatElapsed(left)}</p>
      </div>
      <button
        type="button"
        onClick={onDone}
        className="ml-1 inline-flex h-9 items-center rounded-sm px-2.5 text-sm font-medium text-lime hover:bg-lime-soft"
      >
        Skip
      </button>
      <span className="sr-only" aria-live="polite">
        Rest {total} seconds
      </span>
    </div>
  );
}
