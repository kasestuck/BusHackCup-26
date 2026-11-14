import { SimulatePurchaseRequestSchema, SimulatePurchaseSuccessSchema } from "../../../../lib/server/contract.ts";
import { throwCommerceError } from "../../../../lib/server/commerce.ts";
import { ECONOMY } from "../../../../lib/server/economy.ts";
import { jsonResponse, parseBody, withAuth } from "../../../../lib/server/http.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const POST = withAuth(async (request, { user }) => {
  const input = await parseBody(request, SimulatePurchaseRequestSchema);
  const { data, error } = await createAdminClient().rpc("simulate_partner_purchase", {
    p_user_id: user.id,
    p_redemption_id: input.redemption_id,
    p_amount_cents: ECONOMY.demoPurchaseAmountCents,
  });
  if (error) throwCommerceError(error);
  return jsonResponse(SimulatePurchaseSuccessSchema, data);
});
