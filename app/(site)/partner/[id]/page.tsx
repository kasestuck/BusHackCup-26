import type { Metadata } from "next";
import { Suspense } from "react";
import { PartnerView } from "@/components/partner/partner-view";

export const metadata: Metadata = {
  title: "Partner dashboard",
  robots: { index: false, follow: false },
};

export default function PartnerPage() {
  // PartnerView reads the [id] param with useParams, which needs a Suspense boundary.
  return (
    <Suspense>
      <PartnerView />
    </Suspense>
  );
}
