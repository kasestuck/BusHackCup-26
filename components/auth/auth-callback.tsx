"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { exchangeCode } from "@/lib/client/auth";
import { safeNext } from "@/lib/client/auth-utils";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconAlert } from "@/components/ui/icons";

/**
 * Landing page for magic links and email confirmations: exchanges the one-time
 * ?code= for a session cookie, then continues to ?next= (same-site only).
 */
export function AuthCallback() {
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // A code is single-use: guard against React running this effect twice in dev.
    if (started.current) return;
    started.current = true;
    const next = safeNext(params.get("next"));
    const providerError = params.get("error_description") ?? params.get("error");
    const code = params.get("code");
    const finish = async () => {
      if (providerError || !code) {
        setError(providerError ? "That link is invalid or has expired. Request a new one." : "This link is missing its sign-in code.");
        return;
      }
      const res = await exchangeCode(code);
      if (res.ok) router.replace(next);
      else setError(res.message);
    };
    void finish();
  }, [params, router]);

  if (error) {
    return (
      <div role="alert" className="space-y-6">
        <span className="grid size-12 place-items-center rounded-md border border-line-strong bg-surface-2 text-danger">
          <IconAlert />
        </span>
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-ink">We couldn&apos;t sign you in.</h1>
          <p className="text-muted">{error}</p>
        </div>
        <ButtonLink href="/login" size="lg" className="w-full" arrow>
          Back to log in
        </ButtonLink>
      </div>
    );
  }

  return (
    <div aria-busy="true" className="space-y-5">
      <h1 className="font-display text-3xl font-bold tracking-tight text-ink">Signing you in…</h1>
      <Skeleton className="h-2 w-full rounded-full" />
    </div>
  );
}
