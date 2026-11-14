import { CheckinRequestSchema, CheckinSuccessSchema } from "../../../lib/server/contract.ts";
import { readCheckinDates, readProfile } from "../../../lib/server/data.ts";
import { ECONOMY } from "../../../lib/server/economy.ts";
import { HttpError, jsonResponse, parseBody, withAuth } from "../../../lib/server/http.ts";
import { verifyGymQrToken } from "../../../lib/server/qr.ts";
import { hashRateLimitKey, rateLimiter } from "../../../lib/server/rate-limit.ts";
import { calculateStreak } from "../../../lib/server/streak.ts";
import { createAdminClient } from "../../../lib/server/supabase.ts";
import { localDateAt } from "../../../lib/server/time.ts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = withAuth(async (request, { user, supabase }) => {
  const limits = ECONOMY.rateLimits;
  if (!rateLimiter.consume(hashRateLimitKey("checkin-user", user.id), limits.checkinPerUser, limits.windowSeconds)) {
    throw new HttpError(429, "rate_limited");
  }
  const input = await parseBody(request, CheckinRequestSchema);
  const admin = createAdminClient();
  const { data: gym, error: gymError } = await admin.from("gyms")
    .select("qr_secret").eq("id", input.gym_id).maybeSingle();
  if (gymError) throw gymError;
  if (!gym) throw new HttpError(422, "validation_error");
  const now = new Date();
  if (!verifyGymQrToken(gym.qr_secret, input.token, now)) {
    throw new HttpError(422, "invalid_qr_token");
  }

  // One trusted server instant governs token acceptance and the gym's local date.
  // The database owns the unique constraint, insert and reward transaction.
  const { data, error } = await admin.rpc("record_gym_checkin", {
    p_user_id: user.id,
    p_gym_id: input.gym_id,
    p_checked_in_at: now.toISOString(),
  });
  if (error) {
    if (error.code === "P0001" && error.message === "already_checked_in") {
      throw new HttpError(409, "already_checked_in");
    }
    if (error.code === "P0001" && ["validation_error", "gym_not_found"].includes(error.message)) {
      throw new HttpError(422, "validation_error");
    }
    throw error;
  }
  const profile = await readProfile(supabase, user.id);
  if (!profile) throw new Error("The check-in profile is missing.");
  const dates = await readCheckinDates(supabase, user.id, profile.timezone, now);
  const streak = calculateStreak({
    weekdays: profile.weekdays,
    checkinDates: dates,
    today: localDateAt(now, profile.timezone),
  });
  return jsonResponse(CheckinSuccessSchema, { coins_earned: data.coins_earned, streak, balance: data.balance });
});
