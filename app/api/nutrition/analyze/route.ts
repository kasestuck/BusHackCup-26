import { NutritionSuccessSchema } from "../../../../lib/server/contract.ts";
import { readIsPro } from "../../../../lib/server/data.ts";
import { ECONOMY } from "../../../../lib/server/economy.ts";
import { HttpError, jsonResponse, withAuth } from "../../../../lib/server/http.ts";
import { analyzeNutritionImage, readNutritionImage } from "../../../../lib/server/nutrition.ts";
import { hashRateLimitKey, rateLimiter } from "../../../../lib/server/rate-limit.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const POST = withAuth(async (request, { user, supabase }) => {
  // Verify current subscription before reading the upload or calling the AI provider.
  if (!await readIsPro(supabase, user.id, new Date())) throw new HttpError(402, "pro_required");
  const limits = ECONOMY.rateLimits;
  if (!rateLimiter.consume(hashRateLimitKey("nutrition-user", user.id), limits.nutritionPerUser, limits.windowSeconds)) {
    throw new HttpError(429, "rate_limited");
  }
  const dataUrl = await readNutritionImage(request);
  const result = await analyzeNutritionImage(dataUrl);
  const { error } = await createAdminClient().from("food_logs").insert({ user_id: user.id, result_json: result });
  if (error) throw error;
  return jsonResponse(NutritionSuccessSchema, result);
});
