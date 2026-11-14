import { GymsSuccessSchema, type Gym } from "../../../lib/server/contract.ts";
import { readAllRows } from "../../../lib/server/data.ts";
import { jsonResponse, withAuth } from "../../../lib/server/http.ts";
import { createAdminClient } from "../../../lib/server/supabase.ts";

export const GET = withAuth(async () => {
  const admin = createAdminClient();
  const gyms = await readAllRows<Gym>((from, to) => admin.from("gyms")
    .select("id,name,city,address")
    .order("name").order("id").range(from, to));
  return jsonResponse(GymsSuccessSchema, { gyms });
});
