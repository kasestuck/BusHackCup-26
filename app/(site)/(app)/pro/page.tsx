import type { Metadata } from "next";
import { PaywallView } from "@/components/pro/paywall-view";

export const metadata: Metadata = { title: "ShowUp Pro" };

export default function ProPage() {
  return <PaywallView />;
}
