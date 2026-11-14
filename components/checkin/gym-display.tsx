"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { API_ROUTES, GymsResponseSchema, QrTokenResponseSchema } from "@/lib/contract";
import { apiRequest } from "@/lib/client/api";
import { useApi } from "@/lib/client/use-api";
import { checkinUrl, formatCountdown } from "@/lib/client/checkin";
import { USE_MOCKS } from "@/lib/client/mocks";
import { EARN_RULES } from "@/lib/client/economy";
import { LogoMark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Eyebrow } from "@/components/ui/section-header";
import { IconAlert, IconLock, IconWifiOff } from "@/components/ui/icons";
import { QrCode } from "./qr-code";

const keyStorage = (gymId: string) => `showup.gymKey.${gymId}`;

/**
 * The gym's own device keeps its key locally, so staff enter it once.
 * It never ships in the bundle (server-only GYM_ADMIN_KEY, SPEC §11).
 */
function readKey(gymId: string): string | null {
  try {
    return window.localStorage.getItem(keyStorage(gymId));
  } catch {
    return null;
  }
}
function writeKey(gymId: string, key: string | null) {
  try {
    if (key === null) window.localStorage.removeItem(keyStorage(gymId));
    else window.localStorage.setItem(keyStorage(gymId), key);
  } catch {
    // Storage blocked: the key lives for this page view only.
  }
}

type TokenState =
  | { status: "loading" }
  | { status: "ready"; token: string; expiresAt: number; total: number }
  | { status: "offline"; message: string };

function KeyForm({ onSave, rejected }: { onSave: (key: string) => void; rejected: boolean }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSave(value.trim());
  };
  return (
    <Card className="mx-auto max-w-md p-6 sm:p-8">
      <form onSubmit={submit} className="space-y-6">
        <div className="space-y-3">
          <span className="grid size-12 place-items-center rounded-md border border-line-strong bg-surface-2 text-lime">
            <IconLock />
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight text-ink">Set up this gym screen</h1>
          <p className="text-sm leading-relaxed text-muted">
            Enter the gym key from ShowUp to show the rotating check-in QR. It&apos;s stored only on this device.
          </p>
        </div>
        <Input
          label="Gym key"
          type="password"
          autoComplete="off"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={rejected ? "That key was rejected. Check it and try again." : undefined}
          hint={USE_MOCKS ? "Mock mode: any non-empty key works." : undefined}
        />
        <Button type="submit" size="lg" className="w-full" disabled={!value.trim()}>
          Show check-in QR
        </Button>
      </form>
    </Card>
  );
}

function useTicker() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  return now;
}

function Display({ gymId, gymKey, onRejected }: { gymId: string; gymKey: string; onRejected: () => void }) {
  const [state, setState] = useState<TokenState>({ status: "loading" });
  const [gyms] = useApi(API_ROUTES.gyms, GymsResponseSchema);
  const now = useTicker();
  const gym = gyms.status === "success" ? gyms.data.gyms.find((g) => g.id === gymId) : undefined;
  const coins = EARN_RULES.find((r) => r.key === "checkin")!.coins;

  const fetchToken = useCallback(async () => {
    const res = await apiRequest(API_ROUTES.gymQrToken(gymId), QrTokenResponseSchema, {
      headers: { "x-gym-key": gymKey },
    });
    if (res.ok) {
      setState({
        status: "ready",
        token: res.data.token,
        expiresAt: Date.now() + res.data.expires_in * 1000,
        total: res.data.expires_in,
      });
      return res.data.expires_in * 1000;
    }
    if (res.error.status === 401 || res.error.status === 403) {
      onRejected();
      return null;
    }
    setState({ status: "offline", message: res.error.message });
    return 5000; // retry soon after network or server errors
  }, [gymId, gymKey, onRejected]);

  // Refresh exactly when the current token expires (SPEC §7: 60-second windows).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let alive = true;
    const loop = async () => {
      const wait = await fetchToken();
      if (alive && wait !== null) timer = setTimeout(loop, Math.max(1000, wait + 300));
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [fetchToken]);

  const left = state.status === "ready" ? Math.max(0, (state.expiresAt - now) / 1000) : 0;
  const url = state.status === "ready" ? checkinUrl(window.location.origin, gymId, state.token) : null;

  return (
    <div className="grid min-h-[calc(100dvh-4rem)] grid-cols-1 items-center gap-10 py-8 lg:grid-cols-2 lg:gap-16">
      <div className="space-y-6">
        <Eyebrow>{gym ? `${gym.address}, ${gym.city}` : "Partner gym"}</Eyebrow>
        <h1 className="font-display text-hero font-bold text-ink">{gym?.name ?? "Check in here"}</h1>
        <p className="max-w-[30ch] text-xl leading-relaxed text-muted sm:text-2xl">
          Scan with your phone camera to check in and earn{" "}
          <span className="font-semibold text-lime">+{coins} coins</span>.
        </p>
        <p className="text-sm text-subtle">No app? Open ShowUp → Check in, and enter the code.</p>
      </div>

      <div className="mx-auto w-full max-w-[460px]">
        <Card tone="feature" className="p-5 sm:p-6">
          <div className="relative aspect-square overflow-hidden rounded-md">
            {url ? (
              <QrCode value={url} label={`Check-in QR for ${gym?.name ?? "this gym"}`} className="size-full" />
            ) : (
              <div className="skeleton size-full" aria-hidden="true" />
            )}
            {state.status === "offline" && (
              <div className="absolute inset-0 grid place-items-center bg-bg/90 p-6 text-center">
                <div className="space-y-2">
                  <IconWifiOff className="mx-auto text-muted" />
                  <p className="text-sm text-ink">Reconnecting…</p>
                  <p className="text-xs text-muted">{state.message}</p>
                </div>
              </div>
            )}
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">Code</p>
              <p className="font-display text-[2.5rem] font-bold leading-none tracking-[0.08em] tabular text-ink" aria-live="polite">
                {state.status === "ready" ? state.token : "······"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium uppercase tracking-[0.1em] text-muted">New code in</p>
              <p className="font-display text-2xl font-bold tabular text-lime">{formatCountdown(left)}</p>
            </div>
          </div>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
            <div
              className="h-full rounded-full bg-lime transition-[width] duration-300 ease-linear"
              style={{ width: `${state.status === "ready" && state.total ? (left / state.total) * 100 : 0}%` }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}

export function GymDisplay() {
  const params = useParams<{ id: string }>();
  const gymId = decodeURIComponent(params.id ?? "");
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [rejected, setRejected] = useState(false);

  // Read the stored key after mount (localStorage is client-only).
  useEffect(() => {
    const stored = readKey(gymId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time sync from browser storage
    setKey(stored);
  }, [gymId]);

  const onRejected = useCallback(() => {
    writeKey(gymId, null);
    setRejected(true);
    setKey(null);
  }, [gymId]);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[1240px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <LogoMark />
          <span className="font-display text-lg font-bold tracking-[-0.04em] text-ink">
            Show<span className="text-lime">Up</span>
          </span>
          <span className="text-sm text-subtle">· Gym check-in</span>
          {USE_MOCKS && (
            <span className="ml-auto inline-flex h-6 items-center rounded-sm border border-warning/30 bg-warning-soft px-2 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-warning">
              Mock data
            </span>
          )}
          {key && (
            <button
              type="button"
              onClick={() => {
                writeKey(gymId, null);
                setRejected(false);
                setKey(null);
              }}
              className={`${USE_MOCKS ? "" : "ml-auto "}inline-flex h-10 items-center rounded-md px-3 text-sm text-muted hover:bg-white/5 hover:text-ink`}
            >
              Forget key
            </button>
          )}
        </div>
      </header>
      <main id="main" className="mx-auto max-w-[1240px] px-4 sm:px-6 lg:px-8">
        {key === undefined ? null : key === null ? (
          <div className="py-16">
            {rejected && (
              <p role="alert" className="mx-auto mb-4 flex max-w-md items-center gap-2 text-sm text-danger">
                <IconAlert size={16} /> The gym key was rejected.
              </p>
            )}
            <KeyForm
              rejected={rejected}
              onSave={(k) => {
                writeKey(gymId, k);
                setRejected(false);
                setKey(k);
              }}
            />
          </div>
        ) : (
          <Display gymId={gymId} gymKey={key} onRejected={onRejected} />
        )}
      </main>
    </div>
  );
}
