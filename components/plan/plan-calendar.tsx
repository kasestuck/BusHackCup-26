import type { Plan } from "@/lib/contract";
import { WEEKDAY_LONG, getWeek } from "@/lib/client/dashboard";
import { cx } from "@/components/ui/cx";

/** Monday-first week. Training days are selectable; rest days are shown for rhythm only. */
export function PlanCalendar({
  plan,
  today,
  selected,
  onSelect,
}: {
  plan: Plan;
  today: Date;
  selected: number;
  onSelect: (dayIndex: number) => void;
}) {
  const week = getWeek(plan, today);
  return (
    <div role="group" aria-label="Training days this week" className="grid grid-cols-7 gap-1.5 sm:gap-2 lg:gap-3">
      {week.map((d) => {
        const s = d.session;
        const base =
          "relative flex min-h-[84px] flex-col items-center gap-1.5 rounded-md border px-1 py-3 text-center sm:min-h-[132px] sm:items-start sm:px-3.5 sm:py-3.5 sm:text-left";
        const label = (
          <>
            <span
              className={cx(
                "text-[0.6875rem] font-semibold uppercase tracking-[0.1em]",
                d.isToday ? "text-lime" : "text-muted",
              )}
            >
              {d.label}
              {d.isToday && <span className="hidden lg:inline"> · Today</span>}
            </span>
            <span className="font-display text-xl font-bold tabular tracking-tight text-ink sm:text-3xl">
              {d.date.getDate()}
            </span>
          </>
        );
        if (!s) {
          return (
            <div
              key={d.weekday}
              className={cx(base, "border-line/60 bg-transparent", d.isToday && "border-lime-line/50")}
              aria-label={`${WEEKDAY_LONG[d.weekday - 1]}: rest day`}
            >
              {label}
              <span className="hidden text-xs text-subtle sm:block">Rest</span>
            </div>
          );
        }
        const isSel = s.dayIndex === selected;
        return (
          <button
            key={d.weekday}
            type="button"
            aria-pressed={isSel}
            aria-label={`${WEEKDAY_LONG[d.weekday - 1]}${d.isToday ? ", today" : ""}: ${s.day.focus}, ${s.day.duration_min} minutes`}
            onClick={() => onSelect(s.dayIndex)}
            className={cx(
              base,
              "transition-[background-color,border-color,transform] duration-200 active:scale-[0.97]",
              isSel
                ? "border-lime bg-lime-soft shadow-[inset_0_0_0_1px_var(--su-lime)]"
                : "border-line-strong bg-surface hover:border-white/25 hover:bg-surface-2",
            )}
          >
            {label}
            <span className="hidden w-full truncate text-xs font-medium text-ink sm:block">{s.day.focus}</span>
            <span className="hidden text-xs tabular text-muted sm:block">{s.day.duration_min} min</span>
            <span
              aria-hidden="true"
              className={cx("mt-auto size-1.5 rounded-full sm:hidden", isSel ? "bg-lime" : "bg-ink/70")}
            />
          </button>
        );
      })}
    </div>
  );
}
