import { GymQrTokenRequestSchema, GymQrTokenSuccessSchema } from "../../../../../lib/server/contract.ts";
import { ECONOMY } from "../../../../../lib/server/economy.ts";
import { handleError, HttpError, jsonResponse } from "../../../../../lib/server/http.ts";
import { createGymQrToken, safeEqualText } from "../../../../../lib/server/qr.ts";
import { hashRateLimitKey, rateLimiter } from "../../../../../lib/server/rate-limit.ts";
import { createAdminClient, ServerConfigurationError } from "../../../../../lib/server/supabase.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const limits = ECONOMY.rateLimits;
    // The deployment proxy must replace these headers. Without a trusted proxy,
    // requests share a fallback bucket and supplied forwarding headers are spoofable.
    const ip = request.headers.get("x-forwarded-for")?.split(",", 1)[0].trim()
      || request.headers.get("x-real-ip")?.trim() || "unknown";
    if (!rateLimiter.consume(hashRateLimitKey("qr-ip", ip), limits.qrPerIp, limits.windowSeconds)) {
      throw new HttpError(429, "rate_limited");
    }

    const expectedKey = process.env.GYM_ADMIN_KEY;
    if (!expectedKey?.trim()) throw new ServerConfigurationError(["GYM_ADMIN_KEY"]);
    const key = request.headers.get("x-gym-key") ?? "";
    if (!safeEqualText(key, expectedKey)) throw new HttpError(401, "invalid_gym_key");
    if (!rateLimiter.consume(hashRateLimitKey("qr-key", key), limits.qrPerKey, limits.windowSeconds)) {
      throw new HttpError(429, "rate_limited");
    }

    const input = GymQrTokenRequestSchema.safeParse({
      params: await context.params,
      headers: { "x-gym-key": key },
    });
    if (!input.success) throw new HttpError(422, "validation_error");
    const { data: gym, error } = await createAdminClient().from("gyms")
      .select("qr_secret").eq("id", input.data.params.id).maybeSingle();
    if (error) throw error;
    if (!gym) throw new HttpError(404, "gym_not_found");
    return jsonResponse(GymQrTokenSuccessSchema, createGymQrToken(gym.qr_secret));
  } catch (error) {
    return handleError(error);
  }
}
