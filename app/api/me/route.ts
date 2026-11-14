import { MeSuccessSchema } from "../../../lib/server/contract.ts";
import { readCheckinDates, readCoinBalance, readHasPlan, readIsPro, readProfile } from "../../../lib/server/data.ts";
import { jsonResponse, withAuth } from "../../../lib/server/http.ts";
import { calculateStreak } from "../../../lib/server/streak.ts";
import { localDateAt } from "../../../lib/server/time.ts";

export const GET = withAuth(async (_request, { user, supabase }) => {
  const now = new Date();
  const [profile, coinsBalance, isPro, hasPlan] = await Promise.all([
    readProfile(supabase, user.id),
    readCoinBalance(supabase, user.id),
    readIsPro(supabase, user.id, now),
    readHasPlan(supabase, user.id),
  ]);
  const checkinDates = profile && profile.weekdays.length > 0
    ? await readCheckinDates(supabase, user.id, profile.timezone, now)
    : [];
  const streak = profile ? calculateStreak({
    weekdays: profile.weekdays,
    checkinDates,
    today: localDateAt(now, profile.timezone),
  }) : 0;

  return jsonResponse(MeSuccessSchema, {
    profile: profile ? { ...profile, is_pro: isPro } : null,
    coins_balance: coinsBalance,
    streak,
    is_pro: isPro,
    has_plan: hasPlan,
  });
});
