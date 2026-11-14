import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CoinsSchema, ProfileSchema, type Profile } from "./contract.ts";
import { localDateAt } from "./time.ts";

export const PROFILE_COLUMNS = [
  "id", "display_name", "height_cm", "weight_kg", "goal", "workout_types",
  "session_minutes", "weekdays", "injuries", "home_gym_id", "is_pro",
  "equipment", "age", "timezone",
].join(",");

const PAGE_SIZE = 1000;

/** Fetch every page, including projects whose PostgREST limit is below PAGE_SIZE. */
export async function readAllRows<Row>(
  page: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: unknown }>,
): Promise<Row[]> {
  const rows: Row[] = [];
  while (true) {
    const result = await page(rows.length, rows.length + PAGE_SIZE - 1);
    if (result.error) throw result.error;
    if (!result.data) throw new Error("The database returned no row collection.");
    if (result.data.length === 0) return rows;
    rows.push(...result.data);
  }
}

export async function readProfile(client: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await client.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle();
  if (error) throw error;
  return data === null ? null : ProfileSchema.parse(data);
}

export async function readIsPro(client: SupabaseClient, userId: string, now: Date): Promise<boolean> {
  const { data, error } = await client.from("subscriptions")
    .select("current_period_end").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (data === null) return false;
  const expiry = new Date(data.current_period_end).getTime();
  if (!Number.isFinite(expiry)) throw new Error("The subscription expiry is invalid.");
  return expiry > now.getTime();
}

export async function readCoinBalance(client: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await client.rpc("coin_balance", { p_user_id: userId });
  if (error) throw error;
  // PostgREST normally sends a number. Accept an exact integer string as well,
  // but never silently round a bigint outside the API's safe integer range.
  if (typeof data === "string" && /^\d+$/.test(data)) {
    const value = BigInt(data);
    if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error("The coin balance exceeds the API integer range.");
    return CoinsSchema.parse(Number(value));
  }
  return CoinsSchema.parse(data);
}

export async function readHasPlan(client: SupabaseClient, userId: string): Promise<boolean> {
  const { data, error } = await client.from("workout_plans")
    .select("id").eq("user_id", userId).eq("active", true).limit(1);
  if (error) throw error;
  if (data === null) throw new Error("The database returned no plan collection.");
  return data.length > 0;
}

export async function readCheckinDates(
  client: SupabaseClient, userId: string, timezone: string, now: Date,
): Promise<string[]> {
  const rows = await readAllRows<{ checked_in_at: string }>((from, to) => client
    .from("gym_checkins").select("checked_in_at")
    .eq("user_id", userId).lte("checked_in_at", now.toISOString())
    .order("checked_in_at", { ascending: false }).order("id", { ascending: false })
    .range(from, to));
  // Schedule days belong to the profile timezone, not the gym's stored local_date.
  return rows.map((row) => localDateAt(new Date(row.checked_in_at), timezone));
}
