import type { Metadata } from "next";
import { ComingNext } from "@/components/shell/coming-next";
import { IconDumbbell } from "@/components/ui/icons";

export const metadata: Metadata = { title: "Workout session" };

// Plan days are indexed 0–6 (one per weekday at most).
export function generateStaticParams() {
  return Array.from({ length: 7 }, (_, i) => ({ day: String(i) }));
}

export default function Page() {
  return (
    <ComingNext
      title="Workout logging"
      icon={<IconDumbbell />}
      description="Logging sets, reps and weight (lb), then earning XP and coins, lands here next. Your exercises and technique videos are on My Plan."
    />
  );
}
