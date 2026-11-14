"use client";

import { API_ROUTES, MeResponseSchema } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { usePlanGeneration } from "@/lib/client/use-plan-generation";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { FlowHeader } from "./flow-header";
import { GenerationView } from "./generation-view";

/** Standalone plan generation for users who already finished onboarding. */
export function GeneratePage() {
  const [me, retryMe] = useApi(API_ROUTES.me, MeResponseSchema);
  const [generation, start] = usePlanGeneration();

  let body: React.ReactNode;
  if (me.status === "loading") {
    body = (
      <div aria-busy="true" aria-label="Loading" className="space-y-6">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-16 w-4/5" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    );
  } else if (me.status === "error") {
    const kind = errorKindFromStatus(me.error.status);
    body = (
      <ErrorState
        kind={kind}
        message={me.error.message}
        onRetry={retryMe}
        action={kind === "auth" ? <ButtonLink href="/login" arrow>Sign in</ButtonLink> : undefined}
      />
    );
  } else if (!me.data.profile) {
    body = (
      <div className="space-y-6">
        <h1 className="font-display text-hero font-bold text-ink">
          First, a few questions<span className="text-lime">.</span>
        </h1>
        <p className="max-w-[44ch] text-lg text-muted">Your plan is built from your answers. It takes two minutes.</p>
        <ButtonLink href="/onboarding" size="lg" arrow>
          Start onboarding
        </ButtonLink>
      </div>
    );
  } else {
    body = <GenerationView state={generation} onStart={start} days={me.data.profile.weekdays.length} />;
  }

  return (
    <>
      <FlowHeader />
      <main id="main" className="mx-auto max-w-[880px] px-4 pb-24 pt-12 sm:px-6 sm:pt-20 lg:px-8">
        {body}
      </main>
    </>
  );
}
