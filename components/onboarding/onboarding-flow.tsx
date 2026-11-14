"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { API_ROUTES, OnboardingResponseSchema } from "@/lib/contract";
import { apiPost, type ApiError } from "@/lib/client/api";
import { invalidateApi } from "@/lib/client/use-api";
import { usePlanGeneration } from "@/lib/client/use-plan-generation";
import {
  EMPTY_DRAFT,
  STEPS,
  type OnboardingDraft,
  type StepId,
  toOnboardingRequest,
  validateStep,
} from "@/lib/client/onboarding";
import { Button } from "@/components/ui/button";
import { IconAlert, IconShield, IconSpark } from "@/components/ui/icons";
import { FlowHeader } from "./flow-header";
import { GenerationView } from "./generation-view";
import { STEP_META, StepBody } from "./steps";
import { SignInButton } from "@/components/auth/sign-in";

const pad = (n: number) => String(n).padStart(2, "0");

/** `initialDraft` prefills answers when updating an existing profile. */
export function OnboardingFlow({ initialDraft = EMPTY_DRAFT }: { initialDraft?: OnboardingDraft }) {
  const [draft, setDraft] = useState<OnboardingDraft>(initialDraft);
  const [index, setIndex] = useState(0);
  const [attempted, setAttempted] = useState<Partial<Record<StepId, boolean>>>({});
  const [returnToReview, setReturnToReview] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<ApiError | null>(null);
  const [phase, setPhase] = useState<"form" | "generate">("form");
  const [generation, startGeneration] = usePlanGeneration();

  const step = STEPS[index];
  const meta = STEP_META[step];
  const errors = validateStep(step, draft);
  const shownErrors = attempted[step] ? errors : {};
  const isReview = step === "review";

  // Move focus to the step title so keyboard and screen-reader users land on the new step.
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [index]);

  const update = (patch: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const goTo = (i: number) => setIndex(Math.max(0, Math.min(STEPS.length - 1, i)));

  async function submit() {
    // Re-check everything in case an earlier step was edited into an invalid state.
    const firstInvalid = STEPS.findIndex((s) => Object.keys(validateStep(s, draft)).length > 0);
    if (firstInvalid !== -1 && STEPS[firstInvalid] !== "review") {
      setAttempted((a) => ({ ...a, [STEPS[firstInvalid]]: true }));
      setReturnToReview(true);
      goTo(firstInvalid);
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    const res = await apiPost(API_ROUTES.onboarding, OnboardingResponseSchema, toOnboardingRequest(draft));
    setSubmitting(false);
    if (!res.ok) {
      setSubmitError(res.error);
      return;
    }
    invalidateApi();
    setPhase("generate");
    void startGeneration();
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (isReview) {
      void submit();
      return;
    }
    if (Object.keys(errors).length > 0) {
      setAttempted((a) => ({ ...a, [step]: true }));
      return;
    }
    if (returnToReview) {
      setReturnToReview(false);
      goTo(STEPS.length - 1);
    } else {
      goTo(index + 1);
    }
  }

  if (phase === "generate") {
    return (
      <>
        <FlowHeader />
        <main id="main" className="mx-auto max-w-[880px] px-4 pb-24 pt-12 sm:px-6 sm:pt-20 lg:px-8">
          <GenerationView state={generation} onStart={startGeneration} days={draft.weekdays.length} />
        </main>
      </>
    );
  }

  return (
    <>
      <FlowHeader current={index} total={STEPS.length} />
      <main id="main" className="mx-auto max-w-[1120px] px-4 pb-36 pt-8 sm:px-6 sm:pt-14 lg:px-8 lg:pb-24">
        <form onSubmit={onSubmit} noValidate className="grid gap-8 lg:grid-cols-12 lg:gap-16">
          <div key={`intro-${step}`} className="rise space-y-4 lg:sticky lg:top-32 lg:col-span-5 lg:self-start">
            <p className="font-display text-eyebrow font-medium uppercase text-muted">
              Step <span className="text-lime">{pad(index + 1)}</span> / {pad(STEPS.length)}
            </p>
            <h1
              ref={heading}
              tabIndex={-1}
              className="font-display text-[clamp(2.25rem,1.5rem+3vw,3.75rem)] font-bold leading-[0.98] tracking-[-0.035em] text-ink outline-none"
            >
              {meta.title}
            </h1>
            <p className="max-w-[40ch] text-base leading-relaxed text-muted sm:text-lg">{meta.why}</p>
            {(step === "basics" || step === "injuries") && (
              <p className="hidden items-start gap-2 pt-4 text-sm text-subtle lg:flex">
                <IconShield size={16} className="mt-0.5 shrink-0" />
                Your health details are visible only to you.
              </p>
            )}
          </div>

          <div key={`body-${step}`} className="rise space-y-8 lg:col-span-7" style={{ ["--d" as string]: "80ms" }}>
            <StepBody
              step={step}
              draft={draft}
              update={update}
              errors={shownErrors}
              onEdit={(s) => {
                setReturnToReview(true);
                goTo(STEPS.indexOf(s));
              }}
            />

            {isReview && (
              <p className="flex items-start gap-2 text-xs leading-relaxed text-subtle">
                <IconShield size={15} className="mt-px shrink-0" />
                ShowUp gives general fitness guidance, not medical advice. Stop if something hurts, and check with
                a doctor before starting a new program.
              </p>
            )}

            {submitError && (
              <div
                role="alert"
                className="flex items-start gap-3 rounded-md border border-danger/30 bg-danger-soft px-4 py-3.5 text-sm text-ink"
              >
                <IconAlert size={18} className="mt-px shrink-0 text-danger" />
                <div className="space-y-2">
                  <p>{submitError.message}</p>
                  {submitError.status === 401 && (
                    <SignInButton variant="secondary" className="h-9 text-sm" />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions: fixed bar on mobile, inline under the fields on desktop.
              Kept outside the animated wrapper: a transform there would break position:fixed. */}
          <div className="lg:col-span-7 lg:col-start-6 lg:-mt-8">
            <div className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 px-4 pt-3 backdrop-blur-xl sm:px-6 lg:static lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
              <div className="mx-auto flex max-w-[1120px] items-center gap-3 pb-3 lg:pb-0">
                {index > 0 && (
                  <Button variant="ghost" size="lg" onClick={() => goTo(index - 1)} disabled={submitting}>
                    Back
                  </Button>
                )}
                <Button
                  type="submit"
                  size="lg"
                  className="ml-auto min-w-40 flex-1 sm:flex-none lg:ml-0"
                  disabled={submitting}
                  arrow={!isReview}
                  icon={isReview ? <IconSpark size={18} /> : undefined}
                  aria-busy={submitting || undefined}
                >
                  {isReview
                    ? submitting
                      ? "Saving…"
                      : "Build my plan"
                    : returnToReview
                      ? "Back to review"
                      : "Continue"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </main>
    </>
  );
}
