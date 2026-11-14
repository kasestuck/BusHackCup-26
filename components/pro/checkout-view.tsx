"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_ROUTES, MeResponseSchema, SubscribeResponseSchema, type SubscribeResponse } from "@/lib/contract";
import { apiPost, type ApiError } from "@/lib/client/api";
import { invalidateApi, useApi } from "@/lib/client/use-api";
import {
  formatCardNumber,
  formatCvc,
  formatExpiry,
  formatUsd,
  formatZip,
  missingFields,
  type CardDraft,
} from "@/lib/client/checkout";
import { formatDate } from "@/lib/client/rewards";
import { PRO_PRICE_USD } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { IconAlert, IconLock } from "@/components/ui/icons";
import { FlowHeader } from "@/components/onboarding/flow-header";
import { PRO_FEATURES } from "@/components/rewards/pro-features";
import { SignInLink } from "@/components/auth/sign-in";

const EMPTY: CardDraft = { name: "", number: "", expiry: "", cvc: "", zip: "" };

/** Required by SPEC §7: impossible to miss, before any field. */
function DemoBanner() {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-md border border-warning/40 bg-warning-soft px-4 py-3.5 text-sm text-ink"
    >
      <IconAlert size={18} className="mt-px shrink-0 text-warning" />
      <div>
        <p className="font-display font-bold text-warning">Demo mode: no real charge</p>
        <p className="mt-0.5 text-muted">
          Any details work here. Please don&apos;t enter a real card. Nothing you type is sent or stored; only your
          Pro status is saved.
        </p>
      </div>
    </div>
  );
}

function Summary() {
  return (
    <Card className="space-y-5 p-5 sm:p-6">
      <Eyebrow>Order summary</Eyebrow>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-display text-lg font-semibold text-ink">ShowUp Pro</p>
          <p className="text-sm text-muted">Monthly · 30 days of Pro</p>
        </div>
        <p className="font-display text-lg font-semibold tabular text-ink">{formatUsd(PRO_PRICE_USD)}</p>
      </div>
      <ul className="space-y-2 border-t border-line pt-4">
        {PRO_FEATURES.map((f) => (
          <li key={f.title} className="flex gap-2 text-sm text-muted">
            <span className="text-lime" aria-hidden="true">
              ✓
            </span>
            {f.title}
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-sm text-muted">Due today</span>
        <span className="text-right">
          <span className="block font-display text-2xl font-bold tabular text-ink">{formatUsd(PRO_PRICE_USD)}</span>
          <span className="text-xs text-warning">Demo, not charged</span>
        </span>
      </div>
    </Card>
  );
}

function Success({ data }: { data: SubscribeResponse }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      <Badge tone="solid">Pro active</Badge>
      <h1 ref={heading} tabIndex={-1} className="font-display text-hero font-bold text-ink outline-none">
        Welcome to Pro<span className="text-lime">.</span>
      </h1>
      <p className="text-lg text-muted">
        Active until <span className="font-semibold text-ink">{formatDate(data.pro_until)}</span>. Your Pro status is
        saved to your account; only the payment was simulated.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {PRO_FEATURES.map((f, i) => (
          <li key={f.title}>
            <Card className="rise h-full p-4" style={{ ["--d" as string]: `${100 + i * 70}ms` }}>
              <p className="font-display font-semibold text-ink">{f.title}</p>
              <p className="mt-1 text-xs text-muted">{f.detail}</p>
            </Card>
          </li>
        ))}
      </ul>
      <ButtonLink href="/dashboard" size="lg" arrow>
        Go to my dashboard
      </ButtonLink>
    </div>
  );
}

export function CheckoutView() {
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);
  const [card, setCard] = useState<CardDraft>(EMPTY);
  const [tried, setTried] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<SubscribeResponse | null>(null);

  const missing = missingFields(card);
  const err = (k: keyof CardDraft) => (tried && missing.includes(k) ? "Required (any value works in demo mode)." : undefined);
  const set = (k: keyof CardDraft, v: string) => setCard((c) => ({ ...c, [k]: v }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (missing.length) {
      setTried(true);
      return;
    }
    setSubmitting(true);
    setError(null);
    // Card details stay in this component. The API only learns which plan was chosen.
    const res = await apiPost(API_ROUTES.billingSubscribe, SubscribeResponseSchema, { plan: "pro_monthly" });
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setCard(EMPTY);
    invalidateApi();
    setDone(res.data);
    window.scrollTo({ top: 0 });
  }

  let body: React.ReactNode;
  if (done) {
    body = <Success data={done} />;
  } else if (me.status === "loading") {
    body = <Skeleton className="h-[480px] rounded-lg" />;
  } else if (me.status === "success" && me.data.is_pro) {
    body = (
      <div className="mx-auto max-w-xl space-y-6 py-10 text-center">
        <Badge tone="solid">You&apos;re Pro</Badge>
        <h1 className="font-display text-title font-bold text-ink">You already have Pro.</h1>
        <p className="text-muted">There&apos;s nothing to pay for. Everything is unlocked.</p>
        <ButtonLink href="/dashboard" size="lg" arrow>
          Back to dashboard
        </ButtonLink>
      </div>
    );
  } else {
    body = (
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
        <div className="space-y-8 lg:col-span-7">
          <header className="rise space-y-3">
            <Eyebrow>Checkout</Eyebrow>
            <h1 className="font-display text-[clamp(2.25rem,1.6rem+3vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink">
              Upgrade to Pro<span className="text-lime">.</span>
            </h1>
          </header>

          <DemoBanner />

          <div className="lg:hidden">
            <Summary />
          </div>

          <form onSubmit={onSubmit} noValidate className="rise space-y-5" style={{ ["--d" as string]: "80ms" }}>
            {/* autoComplete off + neutral names: browsers shouldn't offer to fill or save a real card here. */}
            <Input
              label="Name on card"
              name="demo-name"
              autoComplete="off"
              placeholder="Alex Morgan"
              value={card.name}
              onChange={(e) => set("name", e.target.value)}
              error={err("name")}
            />
            <Input
              label="Card number"
              name="demo-number"
              autoComplete="off"
              inputMode="numeric"
              placeholder="4242 4242 4242 4242"
              value={card.number}
              onChange={(e) => set("number", formatCardNumber(e.target.value))}
              error={err("number")}
            />
            <div className="grid grid-cols-3 gap-3">
              <Input
                label="Expiry"
                name="demo-exp"
                autoComplete="off"
                inputMode="numeric"
                placeholder="MM / YY"
                value={card.expiry}
                onChange={(e) => set("expiry", formatExpiry(e.target.value))}
                error={err("expiry")}
              />
              <Input
                label="CVC"
                name="demo-cvc"
                autoComplete="off"
                inputMode="numeric"
                placeholder="123"
                value={card.cvc}
                onChange={(e) => set("cvc", formatCvc(e.target.value))}
                error={err("cvc")}
              />
              <Input
                label="ZIP"
                name="demo-zip"
                autoComplete="off"
                inputMode="numeric"
                placeholder="78701"
                value={card.zip}
                onChange={(e) => set("zip", formatZip(e.target.value))}
                error={err("zip")}
              />
            </div>

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink">
                <IconAlert size={18} className="mt-px shrink-0 text-danger" />
                <span>
                  {error.message}
                  {error.status === 401 && (
                    <>
                      {" "}
                      <SignInLink className="font-medium underline" />
                    </>
                  )}
                </span>
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={submitting}
              aria-busy={submitting || undefined}
              icon={<IconLock size={18} />}
            >
              {submitting ? "Processing demo payment…" : `Pay ${formatUsd(PRO_PRICE_USD)} (demo)`}
            </Button>
            <p className="text-center text-xs text-subtle">
              Billing is simulated for this demo. Pro status, features and limits are real.
            </p>
          </form>
        </div>

        <aside className="hidden lg:col-span-5 lg:block">
          <div className="sticky top-28 rise" style={{ ["--d" as string]: "120ms" }}>
            <Summary />
          </div>
        </aside>
      </div>
    );
  }

  return (
    <>
      <FlowHeader exitHref="/pro" />
      <main id="main" className="mx-auto max-w-[1120px] px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {body}
      </main>
    </>
  );
}
