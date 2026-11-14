"use client";

import Link from "next/link";
import { useState } from "react";
import type { Plan } from "@/lib/contract";
import { WEEKDAY_LONG, getWeek, isoWeekday } from "@/lib/client/dashboard";
import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { cx } from "@/components/ui/cx";
import { IconArrowRight, IconClock, IconDumbbell } from "@/components/ui/icons";

export function WeekSchedule({ plan, today }: { plan: Plan | null; today: Date }) {
  const week = getWeek(plan, today);
  const [selected, setSelected] = useState(isoWeekday(today));
  const cell = week[selected - 1];
  const session = cell.session;

  return (
    <Card className="rise p-5 sm:p-6" style={{ ["--d" as string]: "380ms" }}>
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
                "group relative flex flex-col items-center gap-2 rounded-md border px-1 pb-3 pt-2.5 transition-[background-color,border-color,transform] duration-200 active:scale-[0.96] sm:items-start sm:px-3 sm:pb-3.5 sm:pt-3",
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
              <span className="hidden h-4 w-full truncate text-left text-xs text-muted sm:block">
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

      <div
        aria-live="polite"
        className="mt-4 flex min-h-[72px] flex-col justify-center gap-3 rounded-md border border-line bg-bg/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between"
      >
        {session ? (
          <>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted">
                {WEEKDAY_LONG[cell.weekday - 1]}
                {cell.isToday && <span className="text-lime"> · Today</span>}
              </p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold text-ink">{session.day.focus}</p>
              <p className="mt-1 flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <IconClock size={13} /> {session.day.duration_min} min
                </span>
                <span className="inline-flex items-center gap-1">
                  <IconDumbbell size={13} /> {session.day.exercises.length} exercises
                </span>
              </p>
            </div>
            <Link
              href={`/plan?day=${session.dayIndex}`}
              className="group -my-2.5 inline-flex shrink-0 items-center gap-1.5 self-start rounded-sm py-3 text-sm font-semibold text-lime sm:self-center"
            >
              View workout
              <IconArrowRight size={16} className="transition-transform duration-200 group-hover:translate-x-0.5" />
            </Link>
          </>
        ) : (
          <div>
            <p className="text-xs font-medium text-muted">
              {WEEKDAY_LONG[cell.weekday - 1]}
              {cell.isToday && <span className="text-lime"> · Today</span>}
            </p>
            <p className="mt-0.5 text-[0.9375rem] text-ink">
              {plan ? "Rest day. Recovery is part of the plan." : "No plan yet. Your schedule will appear here."}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
