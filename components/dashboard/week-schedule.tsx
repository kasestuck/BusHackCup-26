"use client";

import Link from "next/link";
import { useState } from "react";
import type { Plan } from "@/lib/contract";
import { WEEKDAY_LONG, getNextSession, getWeek, isoWeekday } from "@/lib/client/dashboard";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { cx } from "@/components/ui/cx";
import { IconArrowRight, IconClock, IconDumbbell, IconSpark } from "@/components/ui/icons";

/** How many exercises to preview under the selected day. */
const PREVIEW = 4;

export function WeekSchedule({ plan, today }: { plan: Plan | null; today: Date }) {
  const week = getWeek(plan, today);
  const [selected, setSelected] = useState(isoWeekday(today));
  const cell = week[selected - 1];
  const session = cell.session;
  const next = plan ? getNextSession(plan, today) : null;

  return (
    // h-full + flex: matches the Rewards card height; the day panel takes the remaining space.
    <Card className="rise flex h-full flex-col p-5 sm:p-6" style={{ ["--d" as string]: "380ms" }}>
      <SectionHeader
        eyebrow="This week"
        title="Training schedule"
        href="/plan"
        linkLabel="Full plan"
        id="week-heading"
      />

      <div role="group" aria-labelledby="week-heading" className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {week.map((d) => {
          const isSel = d.weekday === selected;
          const has = !!d.session;
          return (
            <button
              key={d.weekday}
              type="button"
              aria-pressed={isSel}
              aria-label={`${WEEKDAY_LONG[d.weekday - 1]} ${d.date.getDate()}${d.isToday ? ", today" : ""}: ${
                has ? d.session!.day.focus : "rest day"
              }`}
              onClick={() => setSelected(d.weekday)}
              className={cx(
                "group relative flex flex-col items-center gap-2 rounded-md border px-1 pb-3 pt-2.5 text-center transition-[background-color,border-color,transform] duration-200 active:scale-[0.96] sm:items-start sm:px-3 sm:pb-3.5 sm:pt-3 sm:text-left",
                isSel
                  ? "border-lime-line bg-lime-soft"
                  : "border-line bg-bg/30 hover:border-line-strong hover:bg-surface-2",
                d.isPast && !isSel && "opacity-55",
              )}
            >
              <span
                className={cx(
                  "text-[0.6875rem] font-semibold uppercase tracking-[0.1em]",
                  d.isToday ? "text-lime" : "text-muted",
                )}
              >
                {d.label}
              </span>
              <span className="font-display text-xl font-bold tabular tracking-tight text-ink sm:text-[1.75rem]">
                {d.date.getDate()}
              </span>
              {/* Two lines instead of an ellipsis: "Upper body pull" stays readable. */}
              <span
                className={cx(
                  "hidden min-h-8 w-full text-xs leading-4 [overflow-wrap:anywhere] sm:line-clamp-2",
                  has ? "text-ink/80" : "text-subtle",
                )}
              >
                {has ? d.session!.day.focus : "Rest"}
              </span>
              <span
                aria-hidden="true"
                className={cx(
                  "size-1.5 rounded-full sm:absolute sm:right-3 sm:top-3.5",
                  has ? (d.isToday ? "animate-pulse-dot bg-lime" : "bg-ink/80") : "bg-transparent",
                )}
              />
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="mt-4 flex flex-1 flex-col rounded-md border border-line bg-bg/40 px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted">
              {WEEKDAY_LONG[cell.weekday - 1]}
              {cell.isToday && <span className="text-lime"> · Today</span>}
            </p>
            <p className="mt-0.5 font-display text-lg font-semibold text-ink">
              {session ? session.day.focus : plan ? "Rest day" : "No plan yet"}
            </p>
            {session && (
              <p className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <IconClock size={13} /> {session.day.duration_min} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconDumbbell size={13} /> {session.day.exercises.length} exercises
                </span>
              </p>
            )}
          </div>
          {session && (
            <Link
              href={`/plan?day=${session.dayIndex}`}
              className="group -my-2.5 inline-flex shrink-0 items-center gap-1.5 self-start rounded-sm py-3 text-sm font-semibold text-lime"
            >
              View workout
              <IconArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          )}
        </div>

        {session ? (
          <ol className="mt-4 grid grid-cols-1 gap-x-6 border-t border-line pt-3 sm:grid-cols-2">
            {session.day.exercises.slice(0, PREVIEW).map((ex, i) => (
              <li key={`${ex.slug}-${i}`} className="flex items-baseline gap-3 py-1.5 text-sm">
                <span className="w-5 shrink-0 font-display text-xs font-semibold tabular text-subtle">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0 flex-1 text-ink">{ex.name}</span>
                <span className="shrink-0 text-xs tabular text-muted">
                  {ex.sets} × {ex.reps}
                </span>
              </li>
            ))}
            {session.day.exercises.length > PREVIEW && (
              <li className="py-1.5 pl-8 text-xs text-subtle">
                + {session.day.exercises.length - PREVIEW} more in the full workout
              </li>
            )}
          </ol>
        ) : (
          <p className="mt-3 flex items-start gap-2 text-sm leading-relaxed text-muted">
            <IconSpark size={16} className="mt-0.5 shrink-0 text-lime" />
            {plan
              ? next
                ? `Recovery is part of the plan. Up next: ${WEEKDAY_LONG[next.day.weekday - 1]} · ${next.day.focus}.`
                : "Recovery is part of the plan."
              : "Your schedule appears here once your plan is ready."}
          </p>
        )}
      </div>
    </Card>
  );
}
