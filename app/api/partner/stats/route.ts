import { PartnerStatsRequestSchema, PartnerStatsSuccessSchema } from "../../../../lib/server/contract.ts";
import { throwCommerceError } from "../../../../lib/server/commerce.ts";
import { jsonResponse, parseQuery, withAuth } from "../../../../lib/server/http.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const GET = withAuth(async (request) => {
  const input = parseQuery(request, PartnerStatsRequestSchema.shape.query);
  const { data, error } = await createAdminClient().rpc("partner_stats", { p_partner_id: input.partner_id });
  if (error) throwCommerceError(error);
  return jsonResponse(PartnerStatsSuccessSchema, data);
});
