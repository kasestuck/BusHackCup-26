"use client";

import { API_ROUTES, MeResponseSchema } from "@/lib/contract";
import { useApi } from "@/lib/client/use-api";
import { profileToDraft } from "@/lib/client/onboarding";
import { Skeleton } from "@/components/ui/skeleton";
import { FlowHeader } from "./flow-header";
import { OnboardingFlow } from "./onboarding-flow";

/**
 * Loads the saved profile first so returning users edit their answers instead of
 * starting over. Errors (e.g. signed out) fall through to an empty questionnaire;
 * submitting then shows the sign-in prompt.
 */
export function OnboardingEntry() {
  const [me] = useApi(API_ROUTES.me, MeResponseSchema);

  if (me.status === "loading") {
    return (
      <>
        <FlowHeader />
        <main id="main" aria-busy="true" aria-label="Loading your answers" className="mx-auto grid max-w-[1120px] gap-8 px-4 pt-14 sm:px-6 lg:grid-cols-12 lg:px-8">
          <div className="space-y-4 lg:col-span-5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-16 w-4/5" />
            <Skeleton className="h-5 w-3/4" />
          </div>
          <div className="space-y-4 lg:col-span-7">
            <Skeleton className="h-12 w-64 rounded-md" />
            <Skeleton className="h-12 w-80 rounded-md" />
            <Skeleton className="h-12 w-64 rounded-md" />
          </div>
        </main>
      </>
    );
  }

  const profile = me.status === "success" ? me.data.profile : null;
  // Key on the profile so a late-arriving profile can't be ignored by stale state.
  return profile ? (
    <OnboardingFlow key={profile.id} initialDraft={profileToDraft(profile)} />
  ) : (
    <OnboardingFlow key="new" />
  );
}
