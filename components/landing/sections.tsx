import Link from "next/link";
import { EARN_RULES, PRO_PRICE_USD } from "@/lib/client/economy";
import { formatUsd } from "@/lib/client/checkout";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { IconCoin, IconGift, IconLock, IconPlay, IconShield } from "@/components/ui/icons";
import { PlanComparison } from "@/components/pro/plan-comparison";
import { ProductPreview } from "./product-preview";

const container = "mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8";

/* ---------------------------------- Hero --------------------------------- */

export function Hero() {
  return (
    <section className="grain relative overflow-hidden border-b border-line">
      <div className={`${container} grid grid-cols-1 items-center gap-14 pb-20 pt-14 sm:pt-20 lg:grid-cols-12 lg:gap-10 lg:pb-28 lg:pt-24`}>
        <div className="rise space-y-8 lg:col-span-7">
          <Eyebrow>AI fitness + gym rewards</Eyebrow>
          <h1 className="font-display text-[clamp(2.75rem,1.4rem+5.4vw,5.5rem)] font-bold leading-[0.95] tracking-[-0.04em] text-ink">
            <span className="text-muted">You pay for the gym.</span>
            <br />
            We make sure you actually go<span className="text-lime">.</span>
          </h1>
          <p className="max-w-[46ch] text-lg leading-relaxed text-muted sm:text-xl">
            ShowUp builds your weekly workout plan around your time and equipment, then pays you coins for every
            verified gym visit. Spend them on Pro or partner discounts.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <ButtonLink href="/onboarding" size="lg" arrow>
              Get started
            </ButtonLink>
            <ButtonLink href="#how" variant="secondary" size="lg">
              See how it works
            </ButtonLink>
          </div>
          <p className="text-sm text-subtle">Free to start · Works in your browser, nothing to install</p>
        </div>
        <div className="rise lg:col-span-5" style={{ ["--d" as string]: "160ms" }}>
          <ProductPreview />
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Problem ------------------------------- */

export function Problem() {
  return (
    <section aria-labelledby="problem-heading" className={`${container} py-20 lg:py-28`}>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-4 lg:col-span-4">
          <Eyebrow>The problem</Eyebrow>
          <p className="max-w-[34ch] text-muted">
            For busy people aged 25–45, the membership isn&apos;t the hard part. Walking in, knowing what to do, and
            coming back on Thursday is.
          </p>
        </div>
        <h2
          id="problem-heading"
          className="font-display text-[clamp(2rem,1.3rem+3vw,3.75rem)] font-bold leading-[1.02] tracking-[-0.035em] text-ink lg:col-span-8"
        >
          No time to figure out what to do. <span className="text-muted">No reason to go today.</span>{" "}
          ShowUp fixes both<span className="text-lime">.</span>
        </h2>
      </div>
    </section>
  );
}

/* ------------------------------ How it works ----------------------------- */

const STEPS = [
  {
    title: "Tell us your week",
    body: "Height, weight, injuries, goal, the days you can train and how long you have. Two minutes.",
  },
  {
    title: "Get your AI plan",
    body: "One session for each day you pick, sized to your time, with a technique video for every exercise.",
  },
  {
    title: "Show up and get paid",
    body: "Scan the QR at a partner gym and log your sets. Coins and your streak follow.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-20 border-y border-line bg-surface/40">
      <div className={`${container} py-20 lg:py-28`}>
        <div className="max-w-2xl space-y-4">
          <Eyebrow>How it works</Eyebrow>
          <h2 id="how-heading" className="font-display text-title font-bold text-ink">
            From &ldquo;I should go&rdquo; to checked in, in three steps.
          </h2>
        </div>
        <ol className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex flex-col gap-10 bg-bg p-6 sm:p-8">
              <span className="font-display text-[3.5rem] font-bold leading-none tracking-[-0.05em] text-lime tabular">
                0{i + 1}
              </span>
              <div className="space-y-2">
                <h3 className="font-display text-xl font-semibold text-ink">{s.title}</h3>
                <p className="leading-relaxed text-muted">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* --------------------------------- Rewards ------------------------------- */

export function Rewards() {
  return (
    <section id="rewards" aria-labelledby="rewards-heading" className={`${container} scroll-mt-20 py-20 lg:py-28`}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-8 lg:col-span-6">
          <div className="space-y-4">
            <Eyebrow>Rewards</Eyebrow>
            <h2 id="rewards-heading" className="font-display text-title font-bold text-ink">
              Showing up is the whole game<span className="text-lime">.</span>
            </h2>
            <p className="max-w-[44ch] text-muted">
              Coins come only from verified actions, never from just opening the app.
            </p>
          </div>
          <ul className="divide-y divide-line border-y border-line">
            {[{ key: "plan", coins: 20, title: "Get your first AI plan", detail: "Once." }, ...EARN_RULES].map((r) => (
              <li key={r.key} className="flex items-baseline gap-5 py-4">
                <span className="w-16 shrink-0 font-display text-2xl font-bold tabular tracking-tight text-lime">
                  +{r.coins}
                </span>
                <span>
                  <span className="block font-medium text-ink">{r.title}</span>
                  <span className="text-sm text-muted">{r.detail}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="grid content-start gap-4 lg:col-span-6 lg:pt-20">
          <Card tone="feature" className="space-y-4 p-6 sm:p-7">
            <span className="grid size-11 place-items-center rounded-md bg-lime text-lime-ink">
              <IconCoin size={20} />
            </span>
            <h3 className="font-display text-2xl font-bold tracking-tight text-ink">A month of Pro</h3>
            <p className="text-muted">
              About a month and a half of regular training earns it. By then, the habit is yours.
            </p>
          </Card>
          <Card className="space-y-4 p-6 sm:p-7">
            <span className="grid size-11 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
              <IconGift size={20} />
            </span>
            <h3 className="font-display text-2xl font-bold tracking-tight text-ink">Partner discounts</h3>
            <p className="text-muted">Promo codes for sports nutrition from ShowUp partners.</p>
          </Card>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------- Trust -------------------------------- */

const TRUST = [
  {
    icon: <IconShield size={20} />,
    title: "Injury-aware by design",
    body: "Ongoing injuries remove risky exercises from the list before the AI ever sees it.",
  },
  {
    icon: <IconPlay size={18} />,
    title: "Verified videos only",
    body: "Every exercise comes from our checked catalog with its technique video. The AI never invents links.",
  },
  {
    icon: <IconLock size={20} />,
    title: "Your health data stays yours",
    body: "Only you can see your injuries and weight. Keys and AI calls stay on our servers.",
  },
];

export function Trust() {
  return (
    <section aria-labelledby="trust-heading" className="border-y border-line bg-surface/40">
      <div className={`${container} py-20 lg:py-24`}>
        <h2 id="trust-heading" className="max-w-xl font-display text-title font-bold text-ink">
          Built to be safe, not just smart.
        </h2>
        <ul className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
          {TRUST.map((t) => (
            <li key={t.title} className="space-y-3">
              <span className="grid size-11 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
                {t.icon}
              </span>
              <h3 className="font-display text-lg font-semibold text-ink">{t.title}</h3>
              <p className="leading-relaxed text-muted">{t.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-12 text-sm text-subtle">ShowUp gives general fitness guidance, not medical advice.</p>
      </div>
    </section>
  );
}

/* --------------------------------- Pricing ------------------------------- */

export function Pricing() {
  return (
    <section id="pricing" aria-labelledby="pricing-heading" className={`${container} scroll-mt-20 py-20 lg:py-28`}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:gap-16">
        <div className="space-y-6 lg:col-span-5">
          <Eyebrow>Pricing</Eyebrow>
          <h2 id="pricing-heading" className="font-display text-title font-bold text-ink">
            Free to start. Pro when you want more.
          </h2>
          <p className="flex items-baseline gap-2">
            <span className="font-display text-[clamp(3rem,2.4rem+2.6vw,4.5rem)] font-bold leading-none tracking-[-0.05em] tabular text-ink">
              {formatUsd(PRO_PRICE_USD)}
            </span>
            <span className="text-muted">/ month for Pro</span>
          </p>
          <p className="max-w-[40ch] text-muted">
            Or earn a month of Pro with the coins you collect by showing up.
          </p>
          <ButtonLink href="/onboarding" size="lg" arrow>
            Start free
          </ButtonLink>
          <p className="text-xs text-subtle">Payments are simulated in this demo; Pro features are real.</p>
        </div>
        <Card className="p-5 sm:p-7 lg:col-span-7">
          <PlanComparison />
        </Card>
      </div>
    </section>
  );
}

/* ---------------------------------- CTA ---------------------------------- */

export function FinalCta() {
  return (
    <section className={`${container} pb-20 lg:pb-28`}>
      <div className="grain relative overflow-hidden rounded-xl border border-lime-line bg-surface px-6 py-14 text-center sm:px-12 sm:py-20">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[70%] rounded-full bg-lime/10 blur-3xl" />
        <h2 className="relative mx-auto max-w-[16ch] font-display text-[clamp(2.25rem,1.4rem+3.6vw,4.5rem)] font-bold leading-[0.98] tracking-[-0.04em] text-ink">
          Your next workout starts here<span className="text-lime">.</span>
        </h2>
        <p className="relative mx-auto mt-5 max-w-[40ch] text-lg text-muted">
          Two minutes of questions. A plan built for your week. Coins every time you show up.
        </p>
        <div className="relative mt-8 flex justify-center">
          <ButtonLink href="/onboarding" size="lg" arrow>
            Get started
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Footer -------------------------------- */

export function LandingFooter() {
  return (
    <footer className="border-t border-line">
      <div className={`${container} flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between`}>
        <div className="space-y-2">
          <Wordmark href="/" />
          <p className="text-xs text-subtle">General fitness guidance, not medical advice. Built for Business Cup 2.0.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex gap-1 text-sm">
            <li>
              <Link href="/privacy" className="inline-flex h-10 items-center px-3 text-muted hover:text-ink">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/login" className="inline-flex h-10 items-center px-3 text-muted hover:text-ink">
                Log in
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
