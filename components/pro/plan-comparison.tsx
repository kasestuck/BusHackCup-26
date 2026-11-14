import { PLAN_COMPARISON } from "@/components/rewards/pro-features";
import { cx } from "@/components/ui/cx";

function Cell({ value, pro }: { value: string | boolean; pro: boolean }) {
  if (typeof value === "string") {
    return <span className={cx("text-sm font-semibold tabular", pro ? "text-lime" : "text-muted")}>{value}</span>;
  }
  return value ? (
    <span className={cx("inline-grid size-6 place-items-center rounded-full", pro ? "bg-lime text-lime-ink" : "bg-white/10 text-ink")}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12.5 10 17.5 19 7" />
      </svg>
      <span className="sr-only">Included</span>
    </span>
  ) : (
    <span className="text-subtle">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not included</span>
    </span>
  );
}

/** Free vs Pro table (SPEC §7). Pro column carries the lime emphasis. */
export function PlanComparison() {
  return (
    <table className="w-full border-separate border-spacing-0 text-left">
      <caption className="sr-only">Free and Pro plans compared</caption>
      <thead>
        <tr>
          <th scope="col" className="pb-4 text-xs font-medium text-muted">
            Feature
          </th>
          <th scope="col" className="w-20 pb-4 text-center text-xs font-semibold uppercase tracking-[0.1em] text-muted sm:w-24">
            Free
          </th>
          <th scope="col" className="w-24 rounded-t-md bg-lime-soft pb-4 pt-3 text-center text-xs font-bold uppercase tracking-[0.1em] text-lime sm:w-28">
            Pro
          </th>
        </tr>
      </thead>
      <tbody>
        {PLAN_COMPARISON.map((row, i) => {
          const last = i === PLAN_COMPARISON.length - 1;
          return (
            <tr key={row.feature}>
              <th scope="row" className="border-t border-line py-4 pr-3 text-sm font-medium text-ink">
                {row.feature}
              </th>
              <td className="border-t border-line py-4 text-center">
                <Cell value={row.free} pro={false} />
              </td>
              <td className={cx("border-t border-lime-line/40 bg-lime-soft py-4 text-center", last && "rounded-b-md")}>
                <Cell value={row.pro} pro />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
