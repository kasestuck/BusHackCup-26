import { RewardsSuccessSchema, type Reward } from "../../../lib/server/contract.ts";
import { readAllRows } from "../../../lib/server/data.ts";
import { jsonResponse, withAuth } from "../../../lib/server/http.ts";
import { createAdminClient } from "../../../lib/server/supabase.ts";

export const GET = withAuth(async () => {
  const admin = createAdminClient();
  const rewards = await readAllRows<Reward>((from, to) => admin.from("rewards")
    .select("id,kind,title,partner_id,cost_coins,discount_pct,active")
    .eq("active", true).order("cost_coins").order("id").range(from, to));
  return jsonResponse(RewardsSuccessSchema, { rewards });
});
