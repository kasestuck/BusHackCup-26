"use client";

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  API_ROUTES,
  CheckinResponseSchema,
  GymsResponseSchema,
  MeResponseSchema,
  type CheckinResponse,
  type Gym,
} from "@/lib/contract";
import { apiPost, type ApiError } from "@/lib/client/api";
import { invalidateApi, useApi } from "@/lib/client/use-api";
import { formatNumber } from "@/lib/client/dashboard";
import { normalizeCode, parseCheckinInput, streakLabel } from "@/lib/client/checkin";
import { EARN_RULES } from "@/lib/client/economy";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChoiceCard, ChoiceGroup } from "@/components/ui/choice";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconAlert, IconCoin, IconFlame, IconMapPin } from "@/components/ui/icons";
import { AlreadyCheckedIn, CheckinSuccess } from "./checkin-result";

const CHECKIN_COINS = EARN_RULES.find((r) => r.key === "checkin")!.coins;

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1120px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">{children}</div>;
}

function StatusCard() {
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);
  if (me.status !== "success") {
    return <Skeleton className="h-[148px] rounded-lg" />;
  }
  return (
    <Card className="grid grid-cols-2 divide-x divide-line">
      <div className="p-5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <IconFlame size={15} className="text-lime" /> Streak
        </p>
        <p className="mt-3 font-display text-metric font-bold tabular text-ink">{me.data.streak}</p>
        <p className="mt-1 text-xs text-muted">{me.data.streak === 1 ? "day" : "days"}</p>
      </div>
      <div className="p-5">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <IconCoin size={15} className="text-lime" /> Coins
        </p>
        <p className="mt-3 font-display text-metric font-bold tabular text-ink">{formatNumber(me.data.coins_balance)}</p>
        <p className="mt-1 text-xs text-muted">balance</p>
      </div>
    </Card>
  );
}

const STEPS = [
  { title: "Find the ShowUp QR", detail: "It's on the screen at the front desk of a partner gym." },
  { title: "Scan it with your camera", detail: "This page opens with the gym and code filled in." },
  { title: "Confirm your check-in", detail: `+${CHECKIN_COINS} coins and your streak grows. Once a day.` },
];

export function CheckinView() {
  const params = useSearchParams();
  const fromQr = params.get("token") !== null;
  const [gyms, retryGyms] = useApi(API_ROUTES.gyms, GymsResponseSchema);
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);

  const [gymId, setGymId] = useState<string | null>(params.get("gym"));
  const [code, setCode] = useState(params.get("token") ?? "");
  const [codeError, setCodeError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [done, setDone] = useState<{ result: CheckinResponse; gym: Gym | null } | null>(null);
  const [already, setAlready] = useState<string | null>(null);

  const list = gyms.status === "success" ? gyms.data.gyms : [];
  const homeGym = me.status === "success" ? me.data.profile?.home_gym_id ?? null : null;
  // Default to the home gym when nothing came from the QR link.
  const selectedId = gymId ?? (homeGym && list.some((g) => g.id === homeGym) ? homeGym : null);
  const selected = list.find((g) => g.id === selectedId) ?? null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    // Accept a pasted check-in link as well as a typed code.
    const parsed = parseCheckinInput(code, window.location.origin);
    const gym = parsed.gymId ?? selectedId;
    if (parsed.gymId) setGymId(parsed.gymId);
    if (!gym) {
      setError({ status: 422, code: "gym_required", message: "Choose the gym you're at." });
      return;
    }
    if (!parsed.token) {
      setCodeError("Enter the code shown under the QR.");
      return;
    }
    setCodeError(null);
    setSubmitting(true);
    const res = await apiPost(API_ROUTES.checkin, CheckinResponseSchema, { gym_id: gym, token: parsed.token });
    setSubmitting(false);
    if (res.ok) {
      invalidateApi();
      setDone({ result: res.data, gym: list.find((g) => g.id === gym) ?? null });
      window.scrollTo({ top: 0 });
      return;
    }
    if (res.error.status === 409) {
      invalidateApi();
      setAlready(res.error.message);
      return;
    }
    if (res.error.status === 422 && res.error.code !== "gym_required") {
      setCodeError(res.error.message);
      return;
    }
    setError(res.error);
  }

  if (done) {
    return (
      <Frame>
        <CheckinSuccess result={done.result} gym={done.gym} />
      </Frame>
    );
  }
  if (already) {
    return (
      <Frame>
        <AlreadyCheckedIn streak={me.status === "success" ? me.data.streak : null} message={already} />
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="space-y-8 lg:col-span-7">
          <header className="rise space-y-4">
            <Eyebrow>Gym check-in</Eyebrow>
            <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.5rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
              Check in<span className="text-lime">.</span> Get paid<span className="text-lime">.</span>
            </h1>
            <p className="max-w-[46ch] text-lg text-muted">
              Scan the QR at the front desk, or enter the code shown under it.{" "}
              <span className="font-semibold text-lime">+{CHECKIN_COINS} coins</span>, once a day.
            </p>
            {fromQr && (
              <Badge tone="lime" dot>
                Code filled in from the gym QR
              </Badge>
            )}
          </header>

          <form onSubmit={onSubmit} noValidate className="rise space-y-8" style={{ ["--d" as string]: "80ms" }}>
            <ChoiceGroup legend="Where are you training?">
              {gyms.status === "loading" && (
                <div className="space-y-2" aria-busy="true" aria-label="Loading gyms">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className="h-[76px] rounded-lg" />
                  ))}
                </div>
              )}
              {gyms.status === "error" && (
                <Card>
                  <ErrorState
                    compact
                    kind={errorKindFromStatus(gyms.error.status)}
                    message={gyms.error.message}
                    onRetry={retryGyms}
                    action={
                      gyms.error.status === 401 ? <ButtonLink href="/login" arrow>Sign in</ButtonLink> : undefined
                    }
                  />
                </Card>
              )}
              {gyms.status === "success" &&
                (list.length === 0 ? (
                  <Card>
                    <EmptyState compact icon={<IconMapPin />} title="No partner gyms yet" description="Partner gyms show up here as they join." />
                  </Card>
                ) : (
                  <div className="grid gap-2.5">
                    {list.map((g) => (
                      <ChoiceCard
                        key={g.id}
                        name="gym"
                        value={g.id}
                        title={g.name}
                        description={`${g.address}, ${g.city}${g.id === homeGym ? " · Your home gym" : ""}`}
                        visual={<IconMapPin size={18} />}
                        checked={selectedId === g.id}
                        onChange={() => setGymId(g.id)}
                      />
                    ))}
                  </div>
                ))}
            </ChoiceGroup>

            <Input
              label="Check-in code"
              hint="Shown under the QR on the gym screen. It changes every minute."
              placeholder="e.g. 482915"
              autoComplete="off"
              spellCheck={false}
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setCodeError(null);
              }}
              onBlur={() => setCode((c) => (c.includes("://") ? c : normalizeCode(c)))}
              error={codeError ?? undefined}
              className="max-w-md"
            />

            {error && (
              <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink">
                <IconAlert size={18} className="mt-px shrink-0 text-danger" />
                <span>
                  {error.message}
                  {error.status === 401 && (
                    <>
                      {" "}
                      <a href="/login" className="font-medium underline">
                        Sign in
                      </a>
                    </>
                  )}
                </span>
              </p>
            )}

            <Button
              type="submit"
              size="lg"
              disabled={submitting || gyms.status !== "success" || list.length === 0}
              aria-busy={submitting || undefined}
              className="w-full sm:w-auto"
              icon={<IconMapPin size={18} />}
            >
              {submitting ? "Checking in…" : selected ? `Check in at ${selected.name}` : "Check in"}
            </Button>
          </form>
        </div>

        <aside className="space-y-4 lg:col-span-5 lg:pt-4">
          <div className="rise" style={{ ["--d" as string]: "140ms" }}>
            <StatusCard />
          </div>
          <Card className="rise p-5 sm:p-6" style={{ ["--d" as string]: "200ms" }}>
            <Eyebrow>How it works</Eyebrow>
            <ol className="mt-5 space-y-5">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-4">
                  <span className="font-display text-sm font-bold tabular text-lime">0{i + 1}</span>
                  <div>
                    <p className="font-display font-semibold text-ink">{s.title}</p>
                    <p className="mt-0.5 text-sm text-muted">{s.detail}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
          {me.status === "success" && me.data.streak > 0 && (
            <p className="rise px-1 text-sm text-muted" style={{ ["--d" as string]: "260ms" }}>
              You&apos;re on a <span className="font-semibold text-ink">{streakLabel(me.data.streak)}</span> streak.
            </p>
          )}
        </aside>
      </div>
    </Frame>
  );
}
