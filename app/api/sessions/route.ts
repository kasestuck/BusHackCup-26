import { SessionsRequestSchema, SessionsSuccessSchema } from "../../../lib/server/contract.ts";
import { HttpError, jsonResponse, parseBody, withAuth } from "../../../lib/server/http.ts";
import { validateSessionLog } from "../../../lib/server/session-validation.ts";
import { createAdminClient } from "../../../lib/server/supabase.ts";

export const POST = withAuth(async (request, { user, supabase }) => {
  const input = await parseBody(request, SessionsRequestSchema);
  const { data: plan, error: planError } = await supabase.from("workout_plans")
    .select("plan_json").eq("id", input.plan_id).eq("user_id", user.id).maybeSingle();
  if (planError) throw planError;
  // A missing or foreign plan has the same response; ownership is checked again in SQL.
  if (!plan || !validateSessionLog(input, plan.plan_json).success) {
    throw new HttpError(422, "validation_error");
  }

  const { data, error } = await createAdminClient().rpc("record_workout_session", {
    p_user_id: user.id,
    p_plan_id: input.plan_id,
    p_day_index: input.day_index,
    p_exercises: input.exercises,
  });
  if (error) {
    if (error.code === "P0001" && error.message === "validation_error") {
      throw new HttpError(422, "validation_error");
    }
    throw error;
  }
  return jsonResponse(SessionsSuccessSchema, data);
});
