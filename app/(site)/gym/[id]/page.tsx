import type { Metadata } from "next";
import { Suspense } from "react";
import { GymDisplay } from "@/components/checkin/gym-display";

export const metadata: Metadata = {
  title: "Gym check-in screen",
  robots: { index: false, follow: false },
};

export default function GymScreenPage() {
  // GymDisplay reads the [id] param with useParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <GymDisplay />
    </Suspense>
  );
}
