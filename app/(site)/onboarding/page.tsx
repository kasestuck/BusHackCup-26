import type { Metadata } from "next";
import { OnboardingEntry } from "@/components/onboarding/onboarding-entry";

export const metadata: Metadata = { title: "Build your plan" };

export default function OnboardingPage() {
  return <OnboardingEntry />;
}
