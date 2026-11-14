import { RedeemRequestSchema, RedeemSuccessSchema } from "../../../../lib/server/contract.ts";
import { generatePromoCandidates, throwCommerceError } from "../../../../lib/server/commerce.ts";
import { jsonResponse, parseBody, withAuth } from "../../../../lib/server/http.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const POST = withAuth(async (request, { user }) => {
  const input = await parseBody(request, RedeemRequestSchema);
  const { data, error } = await createAdminClient().rpc("redeem_reward", {
    p_user_id: user.id,
    p_reward_id: input.reward_id,
    p_promo_codes: generatePromoCandidates(),
  });
  if (error) throwCommerceError(error);
  return jsonResponse(RedeemSuccessSchema, data);
});
