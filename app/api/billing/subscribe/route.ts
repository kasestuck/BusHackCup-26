import { SubscribeRequestSchema, SubscribeSuccessSchema } from "../../../../lib/server/contract.ts";
import { throwCommerceError } from "../../../../lib/server/commerce.ts";
import { jsonResponse, parseBody, withAuth } from "../../../../lib/server/http.ts";
import { createAdminClient } from "../../../../lib/server/supabase.ts";

export const POST = withAuth(async (request, { user }) => {
  await parseBody(request, SubscribeRequestSchema);
  const { data, error } = await createAdminClient().rpc("mock_subscribe", { p_user_id: user.id });
  if (error) throwCommerceError(error);
  return jsonResponse(SubscribeSuccessSchema, data);
});
