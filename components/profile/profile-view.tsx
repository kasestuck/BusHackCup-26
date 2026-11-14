"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_ROUTES, MeResponseSchema, type Profile } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { AUTH_MODE, getAccountInfo, type AccountInfo } from "@/lib/client/auth";
import { WEEKDAY_SHORT, formatNumber } from "@/lib/client/dashboard";
import { cmToFtIn, kgToLb } from "@/lib/client/units";
import { formatUsd } from "@/lib/client/checkout";
import { PRO_PRICE_USD } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconCoin, IconFlame, IconShield, IconUser } from "@/components/ui/icons";
import { SignInButton, SignOutButton } from "@/components/auth/sign-in";
import { GOALS, INJURY_AREAS, WORKOUT_TYPES, labelOf } from "@/components/onboarding/options";

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1120px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">{children}</div>;
}

function useAccount() {
  const [account, setAccount] = useState<AccountInfo | null>(null);
  useEffect(() => {
    let alive = true;
    getAccountInfo().then((a) => {
      if (alive) setAccount(a);
    });
    return () => {
      alive = false;
    };
  }, []);
  return account;
}

function initials(name: string | null | undefined, email: string | null) {
  const src = name ?? email?.split("@")[0] ?? "";
  const parts = src.split(/[\s._-]+/).filter(Boolean);
  return parts.length ? parts.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") : "SU";
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 px-5 py-4 sm:grid-cols-[11rem_1fr] sm:gap-4">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-[0.9375rem] text-ink">{children}</dd>
    </div>
  );
}

function TrainingProfile({ p }: { p: Profile }) {
  const h = p.height_cm ? cmToFtIn(p.height_cm) : null;
  const days = [...p.weekdays].sort((a, b) => a - b);
  return (
    <Card>
      <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
        <h2 className="font-display text-lg font-semibold text-ink">Training profile</h2>
        <ButtonLink href="/onboarding" variant="secondary" className="h-10 text-sm">
          Update answers
        </ButtonLink>
      </div>
      <dl className="divide-y divide-line">
        <Row label="Height">{h ? `${h.ft}′${h.in}″` : "—"}</Row>
        <Row label="Weight">{p.weight_kg ? `${formatNumber(kgToLb(p.weight_kg))} lb` : "—"}</Row>
        <Row label="Goal">{p.goal ? labelOf(GOALS, p.goal) : "—"}</Row>
        <Row label="Training">
          {p.workout_types.length ? p.workout_types.map((t) => labelOf(WORKOUT_TYPES, t)).join(", ") : "—"}
        </Row>
        <Row label="Session length">{p.session_minutes ? `${p.session_minutes} minutes` : "—"}</Row>
        <Row label="Training days">
          {days.length ? (
            <span className="flex flex-wrap gap-1.5">
              {WEEKDAY_SHORT.map((d, i) => (
                <span
                  key={d}
                  className={
                    days.includes((i + 1) as (typeof days)[number])
                      ? "rounded-xs bg-lime px-1.5 py-0.5 text-xs font-semibold text-lime-ink"
                      : "rounded-xs bg-white/5 px-1.5 py-0.5 text-xs text-subtle"
                  }
                >
                  {d}
                </span>
              ))}
            </span>
          ) : (
            "—"
          )}
        </Row>
        <Row label="Injuries">
          {p.injuries.length === 0 ? (
            "None"
          ) : (
            <ul className="space-y-1">
              {p.injuries.map((i, n) => (
                <li key={n} className="flex flex-wrap items-center gap-2">
                  {labelOf(INJURY_AREAS, i.area)}
                  <span className="text-muted">· {i.when}</span>
                  <Badge tone={i.status === "ongoing" ? "warning" : "neutral"}>{i.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Row>
      </dl>
      <p className="flex items-start gap-2 border-t border-line px-5 py-4 text-xs leading-relaxed text-subtle">
        <IconShield size={15} className="mt-px shrink-0" />
        Only you can see these details. Updating them lets you generate a new plan (Free: 1 per week).
      </p>
    </Card>
  );
}

function Membership({ isPro, coins }: { isPro: boolean; coins: number }) {
  return (
    <Card tone={isPro ? "feature" : "default"} className="space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink">Membership</h2>
        {isPro ? <Badge tone="solid">PRO</Badge> : <Badge>Free</Badge>}
      </div>
      {isPro ? (
        <p className="text-sm text-muted">Pro is active: more AI plans, nutrition analysis and extended stats.</p>
      ) : (
        <>
          <p className="text-sm text-muted">
            Go Pro for {formatUsd(PRO_PRICE_USD)}/month, or redeem coins for a free month in Rewards.
          </p>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/pro" className="h-10 text-sm" arrow>
              See Pro
            </ButtonLink>
            <ButtonLink href="/rewards" variant="secondary" className="h-10 text-sm">
              {formatNumber(coins)} coins
            </ButtonLink>
          </div>
        </>
      )}
      {isPro && (
        <Link href="/nutrition" className="-my-2 inline-flex py-2 text-sm font-semibold text-lime underline-offset-4 hover:underline">
          Open nutrition analysis →
        </Link>
      )}
    </Card>
  );
}

function Account({ email, isGuest }: { email: string | null; isGuest: boolean }) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-display text-lg font-semibold text-ink">Account</h2>
      <dl className="space-y-1">
        <dt className="text-xs text-muted">Email</dt>
        <dd className="break-all text-[0.9375rem] text-ink">
          {email ??
            (isGuest
              ? "Guest account (no email)"
              : AUTH_MODE === "mock"
                ? "Mock account (no email in mock mode)"
                : "—")}
        </dd>
      </dl>
      <SignOutButton className="w-full" />
      <Link href="/privacy" className="-my-2 block py-2 text-center text-xs text-muted hover:text-ink">
        How we handle your data
      </Link>
    </Card>
  );
}

export function ProfileView() {
  const [me, retry] = useApi(API_ROUTES.me, MeResponseSchema);
  const account = useAccount();
  const email = account?.email ?? null;

  if (me.status === "loading") {
    return (
      <Frame>
        <div aria-busy="true" aria-label="Loading profile" className="space-y-8">
          <div className="flex items-center gap-5">
            <Skeleton className="size-20 rounded-full" />
            <div className="space-y-3">
              <Skeleton className="h-10 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="grid gap-4 lg:grid-cols-12">
            <Skeleton className="h-[460px] rounded-lg lg:col-span-8" />
            <Skeleton className="h-[300px] rounded-lg lg:col-span-4" />
          </div>
        </div>
      </Frame>
    );
  }

  if (me.status === "error") {
    const kind = errorKindFromStatus(me.error.status);
    return (
      <Frame>
        <Card className="mx-auto max-w-lg">
          <ErrorState kind={kind} message={me.error.message} onRetry={retry} action={kind === "auth" ? <SignInButton /> : undefined} />
        </Card>
      </Frame>
    );
  }

  const { profile, is_pro, coins_balance, streak } = me.data;
  const name = profile?.display_name ?? null;

  return (
    <Frame>
      <div className="space-y-10">
        <header className="rise flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-5">
            <span className="grid size-20 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-display text-2xl font-bold text-ink">
              {initials(name, email)}
            </span>
            <div className="min-w-0 space-y-2">
              <Eyebrow>Profile</Eyebrow>
              <h1 className="truncate font-display text-[clamp(2rem,1.5rem+2vw,3rem)] font-bold leading-none tracking-[-0.03em] text-ink">
                {name ?? "Your profile"}
              </h1>
              {email && <p className="truncate text-sm text-muted">{email}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <IconFlame size={14} className="text-lime" /> Streak
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular text-ink">{streak}</dd>
            </div>
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <IconCoin size={14} className="text-lime" /> Coins
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold tabular text-ink">{formatNumber(coins_balance)}</dd>
            </div>
          </dl>
        </header>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          <div className="rise lg:col-span-8" style={{ ["--d" as string]: "80ms" }}>
            {profile ? (
              <TrainingProfile p={profile} />
            ) : (
              <Card>
                <EmptyState
                  icon={<IconUser />}
                  title="No training profile yet"
                  description="Answer a few questions so we can build your AI plan."
                  action={
                    <ButtonLink href="/onboarding" arrow>
                      Start onboarding
                    </ButtonLink>
                  }
                />
              </Card>
            )}
          </div>
          <div className="rise space-y-4 lg:col-span-4" style={{ ["--d" as string]: "140ms" }}>
            <Membership isPro={is_pro} coins={coins_balance} />
            <Account email={email} isGuest={!!account?.isGuest} />
          </div>
        </div>
      </div>
    </Frame>
  );
}
