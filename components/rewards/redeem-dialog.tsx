"use client";

import { useState } from "react";
import { API_ROUTES, RedeemResponseSchema, type RedeemResponse, type Reward } from "@/lib/contract";
import { apiPost, type ApiError } from "@/lib/client/api";
import { invalidateApi } from "@/lib/client/use-api";
import { formatNumber } from "@/lib/client/dashboard";
import { formatDate } from "@/lib/client/rewards";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconAlert, IconCoin } from "@/components/ui/icons";
import { PRO_FEATURES } from "./pro-features";
import { SignInLink } from "@/components/auth/sign-in";

type Phase =
  | { step: "confirm" }
  | { step: "submitting" }
  | { step: "done"; data: RedeemResponse }
  | { step: "error"; error: ApiError };

function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <div className="space-y-2">
      <div className="flex items-stretch overflow-hidden rounded-md border border-lime-line bg-lime-soft">
        <output
          aria-label="Your promo code"
          className="flex flex-1 select-all items-center px-4 py-4 font-display text-xl font-bold tracking-[0.06em] text-lime sm:text-2xl"
        >
          {code}
        </output>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setCopied("ok");
            } catch {
              setCopied("fail");
            }
          }}
          className="border-l border-lime-line px-4 text-sm font-semibold text-ink transition-colors hover:bg-lime/15"
        >
          {copied === "ok" ? "Copied" : "Copy"}
        </button>
      </div>
      <p aria-live="polite" className="text-xs text-muted">
        {copied === "fail"
          ? "Couldn't copy automatically. Select the code and copy it."
          : "Save it now. You'll enter it at checkout in the partner's store."}
      </p>
    </div>
  );
}

export function RedeemDialog({
  reward,
  balance,
  onClose,
}: {
  reward: Reward | null;
  balance: number;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ step: "confirm" });
  const open = reward !== null;
  const close = () => {
    onClose();
    setPhase({ step: "confirm" });
  };

  if (!reward) return <Dialog open={false} onClose={close} title="">{null}</Dialog>;

  const isPro = reward.kind === "pro_month";

  async function redeem() {
    if (!reward) return;
    setPhase({ step: "submitting" });
    const res = await apiPost(API_ROUTES.rewardsRedeem, RedeemResponseSchema, { reward_id: reward.id });
    if (res.ok) {
      invalidateApi();
      setPhase({ step: "done", data: res.data });
    } else {
      setPhase({ step: "error", error: res.error });
    }
  }

  if (phase.step === "done") {
    const { data } = phase;
    return (
      <Dialog
        open={open}
        onClose={close}
        title={isPro ? "Pro is on." : "Your code is ready."}
        description={
          <>
            New balance{" "}
            <span className="font-semibold tabular text-ink">{formatNumber(data.balance)}</span> coins.
          </>
        }
      >
        <div className="space-y-6">
          {data.promo_code && <CopyCode code={data.promo_code} />}
          {isPro && (
            <div className="space-y-4">
              {data.pro_until && (
                <p className="rounded-md border border-lime-line bg-lime-soft px-4 py-3 text-sm text-ink">
                  Active until <span className="font-semibold">{formatDate(data.pro_until)}</span>
                </p>
              )}
              <ul className="space-y-2 text-sm text-muted">
                {PRO_FEATURES.map((f) => (
                  <li key={f.title} className="flex gap-2">
                    <span className="text-lime" aria-hidden="true">
                      ✓
                    </span>
                    {f.title}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button size="lg" className="flex-1" onClick={close}>
              Done
            </Button>
            <ButtonLink href="/dashboard" variant="secondary" size="lg" className="flex-1">
              Dashboard
            </ButtonLink>
          </div>
        </div>
      </Dialog>
    );
  }

  const busy = phase.step === "submitting";
  const after = balance - reward.cost_coins;
  return (
    <Dialog
      open={open}
      onClose={close}
      dismissible={!busy}
      title={`Redeem ${reward.title}?`}
      description={isPro ? "Adds 30 days of ShowUp Pro to your account." : "You'll get a unique promo code for the partner's store."}
    >
      <div className="space-y-6">
        <dl className="divide-y divide-line rounded-md border border-line">
          {[
            { label: "Balance", value: formatNumber(balance) },
            { label: "Cost", value: `− ${formatNumber(reward.cost_coins)}` },
            { label: "After", value: formatNumber(after), strong: true },
          ].map((r) => (
            <div key={r.label} className="flex items-center justify-between px-4 py-3">
              <dt className="text-sm text-muted">{r.label}</dt>
              <dd className={`font-display tabular ${r.strong ? "text-lg font-bold text-ink" : "font-semibold text-ink"}`}>
                {r.value}
              </dd>
            </div>
          ))}
        </dl>

        {phase.step === "error" && (
          <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink">
            <IconAlert size={18} className="mt-px shrink-0 text-danger" />
            <span>
              {phase.error.message}
              {phase.error.status === 401 && (
                <>
                  {" "}
                  <SignInLink className="font-medium underline" />
                </>
              )}
            </span>
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button variant="ghost" size="lg" className="flex-1" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button
            size="lg"
            className="flex-1"
            onClick={redeem}
            disabled={busy || after < 0}
            aria-busy={busy || undefined}
            icon={<IconCoin size={18} />}
          >
            {busy ? "Redeeming…" : phase.step === "error" ? "Try again" : `Redeem for ${formatNumber(reward.cost_coins)}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
