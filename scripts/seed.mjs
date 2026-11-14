#!/usr/bin/env node
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { ECONOMY } from "../lib/server/economy.ts";

const PARTNERS = [
  {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Demo ShowUp Gym Collective",
    type: "gym",
    commission_pct: ECONOMY.gymCommissionPct,
    ref_slug: "demo-showup-gyms",
  },
  {
    id: "10000000-0000-4000-8000-000000000002",
    name: "Demo Cedarbeam Nutrition",
    type: "supplements",
    commission_pct: ECONOMY.partnerCommissionPct,
    ref_slug: "demo-cedarbeam-nutrition",
  },
  {
    id: "10000000-0000-4000-8000-000000000003",
    name: "Demo Junipertrail Supplements",
    type: "supplements",
    commission_pct: ECONOMY.partnerCommissionPct,
    ref_slug: "demo-junipertrail-supplements",
  },
];

const GYMS = [
  {
    id: "20000000-0000-4000-8000-000000000001",
    name: "Demo Cedar Lift Club",
    city: "Austin, TX",
    address: "101 Fictional Cedar Loop (demo address)",
    partner_id: PARTNERS[0].id,
    timezone: "America/Chicago",
  },
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Demo Riverlight Gym",
    city: "Austin, TX",
    address: "202 Fictional Riverlight Lane (demo address)",
    partner_id: PARTNERS[0].id,
    timezone: "America/Chicago",
  },
  {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Demo Juniper Training Hall",
    city: "Austin, TX",
    address: "303 Fictional Juniper Passage (demo address)",
    partner_id: PARTNERS[0].id,
    timezone: "America/Chicago",
  },
];

const REWARDS = [
  {
    id: "30000000-0000-4000-8000-000000000001",
    kind: "pro_month",
    title: `${ECONOMY.proPeriodDays} days of Pro`,
    partner_id: null,
    cost_coins: ECONOMY.rewardCosts.proMonth,
    discount_pct: null,
    active: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000002",
    kind: "partner_product",
    title: `${ECONOMY.discountPct.partnerDiscount15}% off Demo Cedarbeam Nutrition`,
    partner_id: PARTNERS[1].id,
    cost_coins: ECONOMY.rewardCosts.partnerDiscount15,
    discount_pct: ECONOMY.discountPct.partnerDiscount15,
    active: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000003",
    kind: "partner_product",
    title: `${ECONOMY.discountPct.partnerDiscount25}% off Demo Junipertrail Supplements`,
    partner_id: PARTNERS[2].id,
    cost_coins: ECONOMY.rewardCosts.partnerDiscount25,
    discount_pct: ECONOMY.discountPct.partnerDiscount25,
    active: true,
  },
];

const EXERCISE_FIELDS = [
  "slug", "name", "muscle_group", "equipment", "contraindicated_for",
  "video_youtube_id", "video_title", "verified",
];
const EQUIPMENT = new Set(["full_gym", "dumbbells", "bands", "none"]);
const INJURY_AREAS = new Set(["knee", "lower back", "shoulder", "wrist", "ankle", "other"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

class SeedError extends Error {}

function requireValid(condition, message) {
  if (!condition) throw new SeedError(message);
}

function isText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateBuiltInCatalogs() {
  const partnerIds = new Set(PARTNERS.map((row) => row.id));
  const allIds = [...PARTNERS, ...GYMS, ...REWARDS].map((row) => row.id);
  requireValid(allIds.every((id) => UUID_PATTERN.test(id)), "A built-in seed ID is invalid.");
  requireValid(new Set(allIds).size === allIds.length, "Built-in seed IDs must be unique.");
  requireValid(
    new Set(PARTNERS.map((row) => row.ref_slug)).size === PARTNERS.length,
    "Partner reference slugs must be unique.",
  );
  for (const row of PARTNERS) {
    requireValid(
      isText(row.name) && SLUG_PATTERN.test(row.ref_slug) &&
      ["gym", "supplements"].includes(row.type) &&
      Number.isFinite(row.commission_pct) && row.commission_pct >= 0 && row.commission_pct <= 100,
      "A built-in partner is invalid.",
    );
  }
  for (const row of GYMS) {
    requireValid(
      isText(row.name) && isText(row.city) && isText(row.address) &&
      partnerIds.has(row.partner_id) && row.timezone === "America/Chicago",
      "A built-in gym is invalid.",
    );
  }
  for (const row of REWARDS) {
    requireValid(
      isText(row.title) && Number.isSafeInteger(row.cost_coins) &&
      row.cost_coins > 0 && typeof row.active === "boolean",
      "A built-in reward is invalid.",
    );
    requireValid(
      (row.kind === "pro_month" && row.partner_id === null && row.discount_pct === null) ||
      (row.kind === "partner_product" && partnerIds.has(row.partner_id) &&
        Number.isFinite(row.discount_pct) && row.discount_pct > 0 && row.discount_pct <= 100),
      "A built-in reward has invalid kind-specific fields.",
    );
  }
}

function validateExercises(value) {
  requireValid(Array.isArray(value) && value.length >= 50 && value.length <= 60,
    "The exercise seed must contain between 50 and 60 exercises.");
  const slugs = new Set();
  for (const [index, row] of value.entries()) {
    const label = "Exercise row " + (index + 1);
    requireValid(
      row !== null && typeof row === "object" && !Array.isArray(row),
      label + " must be an object.",
    );
    const keys = Object.keys(row);
    requireValid(
      keys.length === EXERCISE_FIELDS.length &&
      EXERCISE_FIELDS.every((field) => Object.hasOwn(row, field)),
      label + " has unexpected or missing fields.",
    );
    requireValid(typeof row.slug === "string" && SLUG_PATTERN.test(row.slug), label + " has an invalid slug.");
    requireValid(!slugs.has(row.slug), label + " repeats an exercise slug.");
    slugs.add(row.slug);
    requireValid(isText(row.name) && isText(row.muscle_group), label + " needs a name and muscle group.");
    requireValid(EQUIPMENT.has(row.equipment), label + " has invalid equipment.");
    requireValid(
      Array.isArray(row.contraindicated_for) &&
      row.contraindicated_for.every((area) => INJURY_AREAS.has(area)) &&
      new Set(row.contraindicated_for).size === row.contraindicated_for.length,
      label + " has invalid contraindications.",
    );
    // Human-reviewed video metadata belongs in the database, not this unverified seed.
    requireValid(
      row.video_youtube_id === null && row.video_title === null && row.verified === false,
      label + " must have null video metadata and verified=false.",
    );
  }
  return value;
}

function getConfiguration(env) {
  requireValid(isText(env.SUPABASE_URL), "Set SUPABASE_URL before running the seed.");
  requireValid(
    isText(env.SUPABASE_SERVICE_ROLE_KEY),
    "Set SUPABASE_SERVICE_ROLE_KEY before running the seed.",
  );
  let url;
  try {
    url = new URL(env.SUPABASE_URL);
  } catch {
    throw new SeedError("SUPABASE_URL must be a valid project URL.");
  }
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  requireValid(
    url.protocol === "https:" || (url.protocol === "http:" && loopback),
    "SUPABASE_URL must use HTTPS, except for a local Supabase instance.",
  );
  requireValid(
    !url.username && !url.password && !url.search && !url.hash &&
    (url.pathname === "/" || url.pathname === ""),
    "SUPABASE_URL must contain only the project origin.",
  );
  return { origin: url.origin, key: env.SUPABASE_SERVICE_ROLE_KEY };
}

function createRestClient(configuration, fetchImpl) {
  return async function request(table, { method = "POST", query = {}, rows, prefer, readJson = false } = {}) {
    const url = new URL("/rest/v1/" + table, configuration.origin);
    for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
    const headers = {
      apikey: configuration.key,
      Accept: "application/json",
    };
    if (!configuration.key.startsWith("sb_")) headers.Authorization = "Bearer " + configuration.key;
    if (rows !== undefined) headers["Content-Type"] = "application/json";
    if (prefer) headers.Prefer = prefer;
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        headers,
        body: rows === undefined ? undefined : JSON.stringify(rows),
        redirect: "error",
        signal: AbortSignal.timeout(30000),
      });
    } catch {
      // Fetch errors can contain URLs or headers, so never forward their message.
      throw new SeedError("The " + table + " request failed or timed out.");
    }
    if (!response.ok) {
      // Do not read or print error bodies: database errors can echo secret-bearing rows.
      await response.body?.cancel().catch(() => {});
      throw new SeedError("The " + table + " request failed with HTTP " + response.status + ".");
    }
    if (!readJson) {
      await response.body?.cancel().catch(() => {});
      return undefined;
    }
    try {
      return await response.json();
    } catch {
      throw new SeedError("The " + table + " response was not valid JSON.");
    }
  };
}

export async function runSeed({
  argv = process.argv.slice(2),
  env = process.env,
  fetchImpl = globalThis.fetch,
  log = console.log,
} = {}) {
  const [nodeMajor, nodeMinor] = process.versions.node.split(".").map(Number);
  requireValid(nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 18), "The seed requires Node.js 22.18 or newer.");
  requireValid(
    argv.every((argument) => argument === "--dry-run" || argument === "--help"),
    "Usage: node scripts/seed.mjs [--dry-run] [--help]",
  );
  if (argv.includes("--help")) {
    log("Usage: node scripts/seed.mjs [--dry-run]");
    log("Required environment: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    log("Apply the migrations first. Dry run validates data without credentials or network requests.");
    return;
  }

  let data;
  try {
    data = JSON.parse(await readFile(new URL("./exercises.seed.json", import.meta.url), "utf8"));
  } catch {
    throw new SeedError("Could not read or parse scripts/exercises.seed.json.");
  }
  // Validate every local payload before starting any network request.
  validateBuiltInCatalogs();
  const exercises = validateExercises(data);
  const summary = {
    partners: PARTNERS.length,
    gyms: GYMS.length,
    rewards: REWARDS.length,
    exercises: exercises.length,
  };
  const counts = summary.partners + " partners, " + summary.gyms + " gyms, " +
    summary.rewards + " rewards, " + summary.exercises + " exercises";
  if (argv.includes("--dry-run")) {
    log("Dry run passed: " + counts + ".");
    log("No database requests were made; all exercise videos are unverified.");
    return summary;
  }

  const request = createRestClient(getConfiguration(env), fetchImpl);
  const mergePreference = "resolution=merge-duplicates,missing=default,return=minimal";
  await request("partners", {
    query: { on_conflict: "id" }, rows: PARTNERS, prefer: mergePreference,
  });

  // Read IDs only. Existing secrets never leave the database.
  const knownGyms = await request("gyms", {
    method: "GET",
    query: { select: "id", id: "in.(" + GYMS.map((gym) => gym.id).join(",") + ")" },
    readJson: true,
  });
  requireValid(
    Array.isArray(knownGyms) && knownGyms.every(
      (row) => row !== null && typeof row === "object" && UUID_PATTERN.test(row.id),
    ),
    "The gym ID response had an unexpected shape.",
  );
  const knownGymIds = new Set(knownGyms.map((gym) => gym.id));
  const missingGyms = GYMS.filter((gym) => !knownGymIds.has(gym.id)).map((gym) => ({
    ...gym,
    qr_secret: randomBytes(32).toString("base64url"),
  }));
  if (missingGyms.length > 0) {
    // Concurrent seeds can race on discovery; DO NOTHING preserves the winning secret.
    await request("gyms", {
      query: { on_conflict: "id" },
      rows: missingGyms,
      prefer: "resolution=ignore-duplicates,missing=default,return=minimal",
    });
  }
  for (const gym of GYMS) {
    const { id, ...publicFields } = gym;
    await request("gyms", {
      method: "PATCH", query: { id: "eq." + id },
      rows: publicFields, prefer: "return=minimal",
    });
  }

  await request("rewards", {
    query: { on_conflict: "id" }, rows: REWARDS, prefer: mergePreference,
  });

  // Only these columns participate in INSERT/ON CONFLICT UPDATE. On new rows,
  // the migration supplies null video fields and verified=false; existing metadata survives.
  const exerciseBaseRows = exercises.map((row) => ({
    slug: row.slug,
    name: row.name,
    muscle_group: row.muscle_group,
    equipment: row.equipment,
    contraindicated_for: row.contraindicated_for,
  }));
  await request("exercises", {
    query: {
      on_conflict: "slug",
      columns: "slug,name,muscle_group,equipment,contraindicated_for",
    },
    rows: exerciseBaseRows,
    prefer: mergePreference,
  });

  log("Seed completed: " + counts + ".");
  log("Existing gym secrets and reviewed exercise video metadata were preserved.");
  log("No demo users, check-ins, ledger entries, or sales were created.");
  return summary;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runSeed().catch((error) => {
    console.error(error instanceof SeedError ? error.message : "The seed failed unexpectedly.");
    console.error("Earlier requests may have committed. Rerun the seed after fixing the failure.");
    process.exitCode = 1;
  });
}
