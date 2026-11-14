import type { Metadata } from "next";
import { GeneratePage } from "@/components/onboarding/generate-page";

export const metadata: Metadata = { title: "Generate your plan" };

export default function Page() {
  return <GeneratePage />;
}
