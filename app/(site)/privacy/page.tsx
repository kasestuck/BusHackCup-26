import type { Metadata } from "next";
import { LandingFooter } from "@/components/landing/sections";
import { LandingNav } from "@/components/landing/landing-nav";
import { Eyebrow } from "@/components/ui/section-header";

export const metadata: Metadata = { title: "Privacy" };

/**
 * SPEC §9 requires a Privacy page and a "not medical advice" disclaimer.
 * Every statement below describes how the system is specified to work (SPEC §4–§9);
 * it is a plain-language summary for the hackathon demo, not a legal policy.
 */
const SECTIONS = [
  {
    title: "What we collect",
    body: [
      "Your account email, and the answers you give during onboarding: age, height, weight, injuries, goal, workout types, equipment, session length and training days.",
      "Your workout logs (sets, reps, weight), gym check-ins, coins, rewards you redeem and your Pro status.",
      "If you use nutrition analysis (Pro), the meal photo you upload and the estimate we return.",
    ],
  },
  {
    title: "Who can see it",
    body: [
      "Health details such as injuries and weight are readable only by you. Every table with your data is protected by row-level security in our database: you can read and write only your own rows.",
    ],
  },
  {
    title: "AI and videos",
    body: [
      "To build your plan, our server sends your questionnaire answers and a list of allowed exercises to our AI provider. AI keys never reach your browser.",
      "Technique videos play from YouTube's privacy-enhanced domain (youtube-nocookie.com) and never autoplay.",
    ],
  },
  {
    title: "Payments",
    body: [
      "Billing in this demo is simulated. Card details typed on the checkout screen are not sent to our servers or stored; only your Pro status and its end date are saved.",
    ],
  },
  {
    title: "Not medical advice",
    body: [
      "ShowUp provides general fitness guidance, not medical advice. If you have an ongoing injury or a health condition, talk to a doctor before starting a new program, and stop any exercise that causes pain.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <LandingNav />
      <main id="main" className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20">
        <Eyebrow>Privacy</Eyebrow>
        <h1 className="mt-4 font-display text-[clamp(2.5rem,1.8rem+3vw,4rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
          Your data, in plain language<span className="text-lime">.</span>
        </h1>
        <p className="mt-5 text-lg text-muted">
          A short summary of what ShowUp stores and why. This is a hackathon demo, so this page describes the system
          as built rather than a full legal policy.
        </p>
        <div className="mt-12 space-y-10">
          {SECTIONS.map((s) => (
            <section key={s.title} className="space-y-3 border-t border-line pt-8">
              <h2 className="font-display text-xl font-semibold text-ink">{s.title}</h2>
              {s.body.map((p) => (
                <p key={p} className="leading-relaxed text-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </div>
      </main>
      <LandingFooter />
    </>
  );
}
