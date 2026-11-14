import { CompletedProfileSchema, OnboardingRequestSchema, OnboardingSuccessSchema } from "../../../lib/server/contract.ts";
import { PROFILE_COLUMNS, readIsPro } from "../../../lib/server/data.ts";
import { HttpError, jsonResponse, parseBody, withAuth } from "../../../lib/server/http.ts";
import { createAdminClient } from "../../../lib/server/supabase.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, { user, supabase }) => {
  const input = await parseBody(request, OnboardingRequestSchema);
  const admin = createAdminClient();

  if (input.home_gym_id) {
    const gym = await admin.from("gyms").select("id").eq("id", input.home_gym_id).maybeSingle();
    if (gym.error) throw gym.error;
    if (gym.data === null) throw new HttpError(422, "validation_error");
  }

  // Only the strict questionnaire DTO is written. Identity comes from getUser().
  // Omitted optional fields, including timezone, retain their database values.
  const { data, error } = await admin.from("profiles").update(input)
    .eq("id", user.id).select(PROFILE_COLUMNS).single();
  if (error) {
    if (error.code === "23503" || error.code === "23514") throw new HttpError(422, "validation_error");
    throw error;
  }
  const profile = CompletedProfileSchema.parse(data);
  const isPro = await readIsPro(supabase, user.id, new Date());
  return jsonResponse(OnboardingSuccessSchema, { profile: { ...profile, is_pro: isPro } });
});
