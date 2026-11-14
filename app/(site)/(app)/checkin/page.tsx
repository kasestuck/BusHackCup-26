import type { Metadata } from "next";
import { Suspense } from "react";
import { CheckinView } from "@/components/checkin/checkin-view";

export const metadata: Metadata = { title: "Gym check-in" };

export default function CheckinPage() {
  // CheckinView reads ?gym=&token= (from the gym QR) via useSearchParams.
  return (
    <Suspense>
      <CheckinView />
    </Suspense>
  );
}
