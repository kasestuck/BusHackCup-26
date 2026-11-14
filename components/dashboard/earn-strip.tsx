import Link from "next/link";
import { EARN_RULES } from "@/lib/client/economy";
import { Eyebrow } from "@/components/ui/section-header";

/** REWARD pillar: how showing up converts into coins (SPEC §7). */
export function EarnStrip() {
  return (
    <section
      aria-labelledby="earn-heading"
      className="rise grain relative overflow-hidden rounded-lg border border-line bg-surface"
      style={{ ["--d" as string]: "500ms" }}
    >
      <div className="grid gap-px bg-line lg:grid-cols-[1.1fr_repeat(3,1fr)]">
        <div className="flex flex-col justify-between gap-6 bg-surface p-5 sm:p-6">
          <Eyebrow>How it pays</Eyebrow>
          <h2 id="earn-heading" className="max-w-[16ch] font-display text-2xl font-bold leading-tight tracking-tight text-ink">
            Showing up is the whole game.
          </h2>
        </div>
        {EARN_RULES.map((r, i) => (
          <div key={r.key} className="group bg-surface p-5 transition-colors duration-300 hover:bg-surface-2/60 sm:p-6">
            <div className="flex items-start justify-between">
              <span className="font-display text-xs font-semibold tabular text-subtle">0{i + 1}</span>
              <span className="font-display text-[2.5rem] font-bold leading-none tracking-[-0.04em] text-lime tabular">
                +{r.coins}
              </span>
            </div>
            <p className="mt-6 font-display text-base font-semibold text-ink">{r.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted">{r.detail}</p>
            {r.key === "checkin" && (
              <Link
                href="/checkin"
                className="-mb-2 mt-2 inline-flex py-2 text-sm font-semibold text-lime underline-offset-4 hover:underline"
              >
                Check in now →
              </Link>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
