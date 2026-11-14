import type { Metadata } from "next";
import { Suspense } from "react";
import { Frame, PlanView } from "@/components/plan/plan-view";
import { PlanSkeleton } from "@/components/plan/plan-skeleton";

export const metadata: Metadata = { title: "My Plan" };

export default function PlanPage() {
  // PlanView reads ?day= via useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense
      fallback={
        <Frame>
          <PlanSkeleton />
        </Frame>
      }
    >
      <PlanView />
    </Suspense>
  );
}
