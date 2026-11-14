import type { Metadata } from "next";
import { Suspense } from "react";
import { WorkoutView } from "@/components/workout/workout-view";

export const metadata: Metadata = { title: "Workout session" };

// Plan days are indexed 0–6 (at most one per weekday).
export function generateStaticParams() {
  return Array.from({ length: 7 }, (_, i) => ({ day: String(i) }));
}

export default function WorkoutPage() {
  // WorkoutView reads the [day] param with useParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <WorkoutView />
    </Suspense>
  );
}
