import { GeneratePlanRequestSchema, GeneratePlanSuccessSchema, UuidSchema } from "../../../../lib/server/contract.ts";
import { PROFILE_COLUMNS, readAllRows } from "../../../../lib/server/data.ts";
import { HttpError, jsonResponse, parseBody, withAuth } from "../../../../lib/server/http.ts";
import { CatalogUnavailableError, createWorkoutPlan, questionnaireFromProfile, type CatalogExercise } from "../../../../lib/server/plans.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, { user, supabase }) => {
  await parseBody(request, GeneratePlanRequestSchema);
  const profileResult = await supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", user.id).maybeSingle();
  if (profileResult.error) throw profileResult.error;
  const questionnaire = questionnaireFromProfile(profileResult.data);
  if (!questionnaire) throw new HttpError(422, "validation_error");

  const admin = createAdminClient();
  const reservation = await admin.rpc("reserve_plan_generation", { p_user_id: user.id });
  if (reservation.error) {
    if (reservation.error.code === "P0001" && reservation.error.message === "pro_required") {
      throw new HttpError(402, "pro_required");
    }
    if (reservation.error.code === "P0001" && reservation.error.message === "rate_limited") {
      throw new HttpError(429, "rate_limited");
    }
    if (reservation.error.code === "P0001" && reservation.error.message === "validation_error") {
      throw new HttpError(422, "validation_error");
    }
    throw reservation.error;
  }
  const attemptId = UuidSchema.parse(reservation.data);
  const catalog = await readAllRows<CatalogExercise>((from, to) => admin.from("exercises")
    .select("slug,name,muscle_group,equipment,contraindicated_for,video_youtube_id,video_title,verified")
    .eq("verified", true).not("video_youtube_id", "is", null).neq("video_youtube_id", "")
    .order("slug").range(from, to));

  let plan;
  try {
    plan = await createWorkoutPlan(questionnaire, catalog);
  } catch (error) {
    if (error instanceof CatalogUnavailableError) throw new HttpError(503, "catalog_unavailable");
    throw error;
  }
  const saved = await admin.rpc("save_generated_plan", {
    p_user_id: user.id,
    p_attempt_id: attemptId,
    p_plan: plan,
    p_input_snapshot: questionnaire,
  });
  if (saved.error) throw saved.error;
  return jsonResponse(GeneratePlanSuccessSchema, saved.data);
});
