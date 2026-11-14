import { ActivePlanSuccessSchema } from "../../../../lib/server/contract.ts";
import { HttpError, jsonResponse, withAuth } from "../../../../lib/server/http.ts";

export const GET = withAuth(async (_request, { user, supabase }) => {
  const { data, error } = await supabase.from("workout_plans")
    .select("plan_json").eq("user_id", user.id).eq("active", true).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "plan_not_found");
  return jsonResponse(ActivePlanSuccessSchema, { plan: data.plan_json });
});
