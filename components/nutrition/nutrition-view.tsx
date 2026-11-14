"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import { API_ROUTES, MeResponseSchema, NutritionResponseSchema, type NutritionResponse } from "@/lib/contract";
import { apiRequest, type ApiError } from "@/lib/client/api";
import { useApi } from "@/lib/client/use-api";
import { checkImageFile } from "@/lib/client/nutrition";
import { prepareImage } from "@/lib/client/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/section-header";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState, errorKindFromStatus } from "@/components/ui/state";
import { IconAlert, IconRefresh, IconSpark } from "@/components/ui/icons";
import { cx } from "@/components/ui/cx";
import { ProGate } from "@/components/pro/pro-gate";
import { MacroBar, NutritionResult } from "./nutrition-result";
import { SignInButton } from "@/components/auth/sign-in";

function Frame({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-[1120px] px-4 pt-8 sm:px-6 sm:pt-12 lg:px-8 lg:pt-14">{children}</div>;
}

function Header() {
  return (
    <header className="rise space-y-4">
      <Eyebrow>Nutrition · Pro</Eyebrow>
      <h1 className="font-display text-[clamp(2.5rem,1.6rem+3.6vw,4.25rem)] font-bold leading-[0.95] tracking-[-0.035em] text-ink">
        Snap your meal<span className="text-lime">.</span>
      </h1>
      <p className="max-w-[46ch] text-lg text-muted">
        One photo, an approximate breakdown of calories, protein, carbs and fat. Good for awareness, not for
        precision.
      </p>
    </header>
  );
}

type Phase =
  | { step: "empty" }
  | { step: "ready" }
  | { step: "analyzing" }
  | { step: "done"; result: NutritionResponse }
  | { step: "error"; error: ApiError };

function Analyzer() {
  const [phase, setPhase] = useState<Phase>({ step: "empty" });
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);

  // Release the preview URL when it changes or the page unmounts.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function pick(f: File | undefined | null) {
    if (!f) return;
    const problem = checkImageFile(f);
    if (problem) {
      setFileError(problem);
      return;
    }
    setFileError(null);
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPhase({ step: "ready" });
  }

  function reset() {
    setFile(null);
    setPreview(null);
    setFileError(null);
    setPhase({ step: "empty" });
    if (libraryInput.current) libraryInput.current.value = "";
    if (cameraInput.current) cameraInput.current.value = "";
  }

  async function analyze() {
    if (!file) return;
    setPhase({ step: "analyzing" });
    const blob = await prepareImage(file);
    const form = new FormData();
    form.append("image", blob, file.name.replace(/\.\w+$/, "") + (blob.type === "image/jpeg" ? ".jpg" : ""));
    const res = await apiRequest(API_ROUTES.nutritionAnalyze, NutritionResponseSchema, { method: "POST", body: form });
    setPhase(res.ok ? { step: "done", result: res.data } : { step: "error", error: res.error });
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  if (phase.step === "error" && phase.error.status === 402) {
    return (
      <ProGate
        feature="Nutrition analysis"
        description={phase.error.message || "Upgrade to analyze meals from a photo."}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-12">
      {/* Photo column */}
      <div className="lg:col-span-5">
        {preview ? (
          <div className="relative overflow-hidden rounded-lg border border-line-strong bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
            <img src={preview} alt="Your meal photo" className="aspect-[4/5] w-full object-cover" />
            {phase.step === "analyzing" && (
              <div className="absolute inset-0 bg-bg/40" aria-hidden="true">
                <div className="absolute inset-x-0 h-1/3 animate-[su-meal-scan_1.8s_var(--su-ease-out)_infinite] bg-gradient-to-b from-transparent via-lime/25 to-transparent" />
              </div>
            )}
          </div>
        ) : (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={cx(
              "flex aspect-[4/5] cursor-pointer flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed px-6 text-center transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-lime",
              dragging ? "border-lime bg-lime-soft" : "border-line-strong bg-surface hover:border-white/25",
            )}
          >
            <input
              ref={libraryInput}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            <span className="grid size-14 place-items-center rounded-full bg-lime text-lime-ink" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.5-2h5L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
            <span className="font-display text-lg font-semibold text-ink">Add a photo of your meal</span>
            <span className="text-sm text-muted">Drop it here or choose from your photos. Top-down, good light works best.</span>
          </label>
        )}

        {/* Phones: open the camera directly */}
        {!preview && (
          <label className="mt-3 flex h-12 cursor-pointer items-center justify-center rounded-md border border-line-strong bg-surface-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-surface-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-lime md:hidden">
            <input
              ref={cameraInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => pick(e.target.files?.[0])}
            />
            Take a photo
          </label>
        )}

        {fileError && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm text-danger">
            <IconAlert size={16} /> {fileError}
          </p>
        )}
      </div>

      {/* Result column */}
      <div className="lg:col-span-7" aria-live="polite">
        {phase.step === "empty" && (
          <Card className="space-y-6 p-6">
            <Eyebrow>What you&apos;ll get</Eyebrow>
            <div className="opacity-50" aria-hidden="true">
              <MacroBar totals={{ kcal: 0, protein_g: 30, carbs_g: 45, fat_g: 12 }} />
            </div>
            <ul className="space-y-2 text-sm text-muted">
              <li>Each food we can see, with an estimated portion in g and oz.</li>
              <li>Calories plus protein, carbs and fat for the whole plate.</li>
              <li>A confidence level, so you know how much to trust it.</li>
            </ul>
          </Card>
        )}

        {phase.step === "ready" && (
          <div className="space-y-5">
            <p className="text-muted">Looks good? We&apos;ll estimate what&apos;s on the plate.</p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" onClick={analyze} icon={<IconSpark size={18} />}>
                Analyze meal
              </Button>
              <Button size="lg" variant="secondary" onClick={reset}>
                Choose another
              </Button>
            </div>
          </div>
        )}

        {phase.step === "analyzing" && (
          <div aria-busy="true" className="space-y-6">
            <p className="font-display text-xl font-semibold text-ink">Reading your plate…</p>
            <Skeleton className="h-16 w-1/2" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-14" />
              ))}
            </div>
            <Skeleton className="h-[180px] rounded-lg" />
          </div>
        )}

        {phase.step === "error" && (
          <Card>
            <ErrorState
              kind={errorKindFromStatus(phase.error.status)}
              message={phase.error.message}
              action={
                phase.error.status === 401 ? (
                  <SignInButton />
                ) : (
                  <div className="flex flex-wrap justify-center gap-3">
                    <Button variant="secondary" onClick={analyze} icon={<IconRefresh size={18} />}>
                      Try again
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      Use another photo
                    </Button>
                  </div>
                )
              }
            />
          </Card>
        )}

        {phase.step === "done" && (
          <div className="rise space-y-6">
            <NutritionResult result={phase.result} />
            <Button size="lg" variant="secondary" onClick={reset} icon={<IconRefresh size={18} />}>
              Analyze another meal
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function NutritionView() {
  const [me, retry] = useApi(API_ROUTES.me, MeResponseSchema);

  let body: React.ReactNode;
  if (me.status === "loading") {
    body = <Skeleton className="h-[420px] rounded-lg" />;
  } else if (me.status === "error") {
    const kind = errorKindFromStatus(me.error.status);
    body = (
      <Card className="mx-auto max-w-lg">
        <ErrorState
          kind={kind}
          message={me.error.message}
          onRetry={retry}
          action={kind === "auth" ? <SignInButton /> : undefined}
        />
      </Card>
    );
  } else if (!me.data.is_pro) {
    body = (
      <ProGate
        feature="Nutrition analysis"
        description="Snap a meal and get an approximate breakdown of calories, protein, carbs and fat in seconds."
        preview={<MacroBar totals={{ kcal: 0, protein_g: 46, carbs_g: 57, fat_g: 13 }} />}
      />
    );
  } else {
    body = <Analyzer />;
  }

  return (
    <Frame>
      <div className="space-y-10">
        <Header />
        <div className="rise" style={{ ["--d" as string]: "100ms" }}>
          {body}
        </div>
      </div>
    </Frame>
  );
}
