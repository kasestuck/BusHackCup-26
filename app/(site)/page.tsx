import type { Metadata } from "next";
import { LandingNav } from "@/components/landing/landing-nav";
import { CoachSection } from "@/components/landing/coach-section";
import {
  FinalCta,
  Hero,
  HowItWorks,
  LandingFooter,
  Pricing,
  Problem,
  Rewards,
  Trust,
} from "@/components/landing/sections";

export const metadata: Metadata = {
  title: { absolute: "ShowUp — You pay for the gym. We make sure you actually go." },
  description:
    "AI workout plans built around your week, and coins for every verified gym visit. Spend them on Pro or partner discounts.",
};

/** Public landing page: fully static, no API calls. */
export default function LandingPage() {
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-lime focus:px-4 focus:py-2 focus:text-lime-ink"
      >
        Skip to content
      </a>
      <LandingNav />
      <main id="main">
        <Hero />
        <Problem />
        <HowItWorks />
        <CoachSection />
        <Rewards />
        <Trust />
        <Pricing />
        <FinalCta />
      </main>
      <LandingFooter />
    </>
  );
}
