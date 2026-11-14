"use client";

import { useCallback, useRef, useState } from "react";
import { API_ROUTES, PlanResponseSchema, type Plan } from "@/lib/contract";
import { apiPost, type ApiError } from "./api";
import { invalidateApi } from "./use-api";

export type GenerationState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "success"; plan: Plan }
  | { status: "error"; error: ApiError };

/**
 * POST /api/plan/generate (5–15 s per SPEC §6). `start` is meant to be called from
 * a user action, never an effect, and ignores repeat calls while one is in flight,
 * so a Free user's weekly generation can't be spent twice by accident.
 */
export function usePlanGeneration() {
  const [state, setState] = useState<GenerationState>({ status: "idle" });
  const inFlight = useRef(false);

  const start = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setState({ status: "running" });
    const r = await apiPost(API_ROUTES.planGenerate, PlanResponseSchema, {});
    inFlight.current = false;
    if (r.ok) {
      // Balance (+20 for a first plan), has_plan and the active plan all changed.
      invalidateApi();
      setState({ status: "success", plan: r.data.plan });
    } else {
      setState({ status: "error", error: r.error });
    }
  }, []);

  return [state, start] as const;
}
