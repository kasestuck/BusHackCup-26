import type { NutritionResponse } from "@/lib/contract";
import { formatNumber } from "@/lib/client/dashboard";
import { gramsToOz, macroSplit, round } from "@/lib/client/nutrition";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { IconAlert } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";

const MACRO_COLOR = { protein: "bg-lime", carbs: "bg-ink/80", fat: "bg-muted/60" } as const;

const CONFIDENCE: Record<NutritionResponse["confidence"], { tone: "lime" | "neutral" | "warning"; label: string }> = {
  high: { tone: "lime", label: "High confidence" },
  medium: { tone: "neutral", label: "Medium confidence" },
  low: { tone: "warning", label: "Low confidence" },
};

export function MacroBar({ totals }: { totals: NutritionResponse["totals"] }) {
  const split = macroSplit(totals);
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={split.map((m) => `${m.label} ${m.pct}% of calories`).join(", ")}>
        {split.map((m) => (
          <div key={m.key} className={cx("h-full origin-left animate-fill", MACRO_COLOR[m.key])} style={{ width: `${m.pct}%` }} />
        ))}
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {split.map((m) => (
          <div key={m.key}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              <span className={cx("size-2 rounded-full", MACRO_COLOR[m.key])} aria-hidden="true" />
              {m.label}
            </dt>
            <dd className="mt-1 font-display text-2xl font-bold tabular tracking-tight text-ink">
              ~{round(m.grams)}
              <span className="ml-0.5 text-sm font-medium text-muted">g</span>
            </dd>
            <dd className="text-xs tabular text-subtle">{m.pct}% of kcal</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export function NutritionResult({ result }: { result: NutritionResponse }) {
  const conf = CONFIDENCE[result.confidence];
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow>Approximate estimate</Eyebrow>
          <Badge tone={conf.tone}>{conf.label}</Badge>
        </div>
        <p className="flex items-baseline gap-2">
          <span className="font-display text-[clamp(3.25rem,2.6rem+3vw,4.75rem)] font-bold leading-none tracking-[-0.05em] tabular text-ink">
            ~{formatNumber(round(result.totals.kcal))}
          </span>
          <span className="text-lg text-muted">kcal</span>
        </p>
      </div>

      <MacroBar totals={result.totals} />

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Foods detected in the photo</caption>
          <thead className="border-b border-line text-xs text-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">Food</th>
              <th scope="col" className="px-2 py-3 text-right font-medium">Portion</th>
              <th scope="col" className="px-4 py-3 text-right font-medium">kcal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {result.items.map((i) => (
              <tr key={i.name}>
                <th scope="row" className="px-4 py-3 font-medium text-ink">
                  {i.name}
                  <span className="mt-0.5 block text-xs font-normal tabular text-subtle">
                    P {round(i.protein_g)}g · C {round(i.carbs_g)}g · F {round(i.fat_g)}g
                  </span>
                </th>
                <td className="px-2 py-3 text-right tabular text-muted">
                  ~{round(i.grams_estimate)} g
                  <span className="block text-xs text-subtle">{gramsToOz(i.grams_estimate)}</span>
                </td>
                <td className="px-4 py-3 text-right font-display font-semibold tabular text-ink">{round(i.kcal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-xs leading-relaxed text-muted">
        <IconAlert size={16} className="mt-px shrink-0 text-subtle" />
        <span>
          {result.disclaimer} Not medical or dietary advice.
        </span>
      </p>
    </div>
  );
}
