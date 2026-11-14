/**
 * Live Supabase Auth/PostgREST security smoke test. Requires Node.js 22 or newer.
 *
 * Required environment variables:
 *   SUPABASE_URL
 *   SUPABASE_ANON_KEY
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run: node scripts/postgrest-smoke.mjs
 *
 * Apply all migrations, including the Auth-to-profile trigger, before running.
 * This creates two temporary Auth users and random, isolated database fixtures.
 * Finally deletes the Auth users and their cascading rows, then catalog fixtures.
 * Cleanup is attempted after failures; forced termination can leave fixtures.
 * Credentials, response bodies, tokens and service URLs are never logged.
 */
import { randomBytes, randomUUID } from 'node:crypto';

class SafeFailure extends Error {}
class SetupFailure extends Error {}

let passed = 0;
let failed = 0;
let baseUrl;
let anon;
let service;
const runId = randomUUID();
const users = ['A', 'B'].map((label) => ({
  label,
  id: randomUUID(),
  email: `postgrest-smoke-${runId}-${label.toLowerCase()}@example.com`,
  password: `Aa1!${randomBytes(36).toString('base64url')}`,
  attempted: false,
  credentials: undefined,
}));
const catalogCleanup = [];

function ensure(condition, explanation) {
  if (!condition) throw new SafeFailure(explanation);
}

async function check(label, action, required = false) {
  try {
    const value = await action();
    passed += 1;
    console.log(`PASS: ${label}`);
    return value;
  } catch (error) {
    failed += 1;
    const detail = error instanceof SafeFailure ? error.message : 'An unexpected error occurred; details were suppressed.';
    console.error(`FAIL: ${label}. ${detail}`);
    if (required) throw new SetupFailure();
    return undefined;
  }
}

function apiKeyCredentials(key) {
  // Opaque Supabase keys belong in apikey, while legacy JWT keys also act as bearer tokens.
  return { key, token: key.startsWith('sb_') ? undefined : key };
}

async function request(relativePath, credentials, { method = 'GET', body, representation = false } = {}) {
  const headers = { apikey: credentials.key, Accept: 'application/json' };
  if (credentials.token) headers.Authorization = `Bearer ${credentials.token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (representation) headers.Prefer = 'return=representation';
  let response;
  let raw;
  try {
    response = await fetch(new URL(relativePath, baseUrl), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
    raw = await response.text();
  } catch {
    throw new SafeFailure('The HTTP request did not complete.');
  }
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { /* Non-JSON responses fail shape assertions. */ }
  return { ok: response.ok, status: response.status, data };
}

function requireSuccess(response) {
  ensure(response.ok, `Expected a successful HTTP response; received HTTP ${response.status}.`);
}

function requirePrivilegeDenial(response) {
  ensure(
    (response.status === 401 || response.status === 403) && response.data?.code === '42501',
    `Expected HTTP 401/403 with PostgreSQL code 42501; received HTTP ${response.status}.`,
  );
}

function tablePath(table, query = {}) {
  return `rest/v1/${table}?${new URLSearchParams(query)}`;
}

async function readRows(table, credentials, query) {
  const response = await request(tablePath(table, query), credentials);
  requireSuccess(response);
  ensure(Array.isArray(response.data), 'Expected an array of database rows.');
  return response.data;
}

async function insertFixture(table, row) {
  const response = await request(`rest/v1/${table}`, service, {
    method: 'POST', body: row, representation: true,
  });
  requireSuccess(response);
  ensure(Array.isArray(response.data) && response.data.length === 1, 'Expected exactly one inserted fixture row.');
  return response.data[0];
}

async function createUser(user) {
  // Supplying our random UUID makes cleanup possible even if the response is lost.
  user.attempted = true;
  const response = await request('auth/v1/admin/users', service, {
    method: 'POST',
    body: {
      id: user.id,
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { display_name: `PostgREST smoke user ${user.label}`, smoke_test_run: runId },
    },
  });
  requireSuccess(response);
  ensure(response.data?.id === user.id, 'The Auth response did not identify the requested test user.');
}

async function login(user) {
  const response = await request('auth/v1/token?grant_type=password', anon, {
    method: 'POST', body: { email: user.email, password: user.password },
  });
  requireSuccess(response);
  ensure(
    response.data?.user?.id === user.id && typeof response.data?.access_token === 'string' && response.data.access_token.length > 0,
    'Password sign-in did not return the expected user and access token.',
  );
  user.credentials = { key: anon.key, token: response.data.access_token };
}

async function cleanup() {
  if (!service || !baseUrl) return;
  for (const user of [...users].reverse()) {
    if (!user.attempted) continue;
    await check(`cleanup removes temporary Auth user ${user.label} and cascading rows`, async () => {
      const response = await request(`auth/v1/admin/users/${user.id}`, service, { method: 'DELETE' });
      ensure(response.ok || response.status === 404, `Auth cleanup returned HTTP ${response.status}.`);
      const lookup = await request(`auth/v1/admin/users/${user.id}`, service);
      ensure(lookup.status === 404, `The deleted Auth user is still present or could not be verified (HTTP ${lookup.status}).`);
      const rows = await readRows('profiles', service, { id: `eq.${user.id}`, select: 'id' });
      ensure(rows.length === 0, 'A profile remains after Auth user cleanup.');
    });
  }
  for (const fixture of [...catalogCleanup].reverse()) {
    await check(`cleanup removes the temporary ${fixture.table} fixture`, async () => {
      const response = await request(tablePath(fixture.table, { id: `eq.${fixture.id}` }), service, { method: 'DELETE' });
      requireSuccess(response);
      const rows = await readRows(fixture.table, service, { id: `eq.${fixture.id}`, select: 'id' });
      ensure(rows.length === 0, 'The catalog fixture remains after cleanup.');
    });
  }
}

async function main() {
  await check('Node.js version and required environment are valid', () => {
    ensure(Number(process.versions.node.split('.')[0]) >= 22, 'Node.js 22 or newer is required.');
    const urlValue = process.env.SUPABASE_URL;
    const anonKey = process.env.SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    ensure(Boolean(urlValue && anonKey && serviceKey), 'Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY.');
    let parsed;
    try { parsed = new URL(urlValue); } catch { throw new SafeFailure('SUPABASE_URL is not a valid URL.'); }
    ensure(
      (parsed.protocol === 'https:' || (parsed.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)))
        && !parsed.username && !parsed.password && !parsed.search && !parsed.hash
        && (parsed.pathname === '/' || parsed.pathname === ''),
      'SUPABASE_URL must be an HTTPS project origin, or HTTP on loopback, without embedded credentials, query or fragment.',
    );
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/`;
    baseUrl = parsed;
    anon = apiKeyCredentials(anonKey);
    service = apiKeyCredentials(serviceKey);
  }, true);

  for (const user of users) {
    await check(`Auth admin creates temporary user ${user.label}`, () => createUser(user), true);
    await check(`Auth trigger creates user ${user.label}'s profile`, async () => {
      const rows = await readRows('profiles', service, { id: `eq.${user.id}`, select: 'id,is_pro' });
      ensure(rows.length === 1 && rows[0].id === user.id && rows[0].is_pro === false, 'Expected one automatically created, non-Pro profile.');
    }, true);
    await check(`user ${user.label} signs in through the password grant`, () => login(user), true);
    await check(`user ${user.label} can read their own profile using the anon key and access token`, async () => {
      const rows = await readRows('profiles', user.credentials, { id: `eq.${user.id}`, select: 'id,is_pro' });
      ensure(rows.length === 1 && rows[0].id === user.id, 'The signed-in user could not read their own profile.');
    }, true);
  }

  const [a, b] = users;
  const partnerId = randomUUID();
  const gymId = randomUUID();
  const rewardId = randomUUID();
  const planId = randomUUID();
  const localDate = new Date().toISOString().slice(0, 10);
  const periodEnd = new Date(Date.now() + 30 * 86400000).toISOString();
  const catalogs = [
    ['partners', {
      id: partnerId, name: 'PostgREST smoke partner', type: 'gym', commission_pct: 0, ref_slug: `smoke-${runId}`,
    }],
    ['gyms', {
      id: gymId, name: 'PostgREST smoke gym', city: 'Test City', address: 'Temporary security fixture',
      qr_secret: randomBytes(32).toString('hex'), partner_id: partnerId, timezone: 'UTC',
    }],
    ['rewards', { id: rewardId, kind: 'pro_month', title: 'PostgREST smoke reward', cost_coins: 100 }],
  ];
  for (const [table, row] of catalogs) {
    catalogCleanup.push({ table, id: row.id });
    await check(`service role creates the temporary ${table} fixture`, () => insertFixture(table, row), true);
  }
  for (const user of users) {
    await check(`service role funds temporary user ${user.label}`, () => insertFixture('coin_ledger', {
      id: randomUUID(), user_id: user.id, amount: 200, reason: 'smoke_credit', ref_id: runId,
    }), true);
  }

  const fixtures = [
    ['workout_plans', { id: planId, user_id: b.id, input_snapshot: {}, plan_json: {} }],
    ['workout_sessions', { id: randomUUID(), user_id: b.id, plan_id: planId, day_index: 0, log_json: [] }],
    ['gym_checkins', { id: randomUUID(), user_id: b.id, gym_id: gymId, local_date: localDate }],
    ['food_logs', { id: randomUUID(), user_id: b.id, image_path: `smoke/${runId}/fixture.jpg`, result_json: {} }],
  ];
  for (const [table, row] of fixtures) {
    await check(`service role creates user B's ${table} fixture`, () => insertFixture(table, row), true);
  }
  await check('service role can redeem a funded reward through the real RPC', async () => {
    const response = await request('rest/v1/rpc/redeem_reward', service, {
      method: 'POST', body: { p_user_id: b.id, p_reward_id: rewardId },
    });
    requireSuccess(response);
    ensure(response.data?.balance === 100 && typeof response.data?.pro_until === 'string', 'Service redemption did not return the expected balance and Pro expiry.');
  }, true);

  for (const table of ['profiles', 'workout_plans', 'workout_sessions', 'gym_checkins', 'coin_ledger', 'redemptions', 'subscriptions', 'food_logs']) {
    const ownershipColumn = table === 'profiles' ? 'id' : 'user_id';
    const query = { [ownershipColumn]: `eq.${b.id}`, select: ownershipColumn };
    await check(`service role can read user B's ${table} rows`, async () => {
      const rows = await readRows(table, service, query);
      ensure(rows.length > 0 && rows.every((row) => row[ownershipColumn] === b.id), 'The fixture is missing or belongs to another user.');
    }, true);
    await check(`user B can read their own ${table} rows`, async () => {
      const rows = await readRows(table, b.credentials, query);
      ensure(rows.length > 0 && rows.every((row) => row[ownershipColumn] === b.id), 'The owner cannot read the existing fixture.');
    });
    await check(`user A cannot read user B's ${table} rows`, async () => {
      const rows = await readRows(table, a.credentials, query);
      ensure(rows.length === 0, 'Another user can read protected rows.');
    });
  }

  await check('authenticated user cannot PATCH their own is_pro', async () => {
    requirePrivilegeDenial(await request(tablePath('profiles', { id: `eq.${a.id}` }), a.credentials, {
      method: 'PATCH', body: { is_pro: true },
    }));
  });
  const forbiddenInserts = [
    ['coin_ledger', { id: randomUUID(), user_id: a.id, amount: 100, reason: 'smoke_forbidden_credit', ref_id: randomUUID() }],
    ['gym_checkins', { id: randomUUID(), user_id: a.id, gym_id: gymId, local_date: localDate }],
    ['redemptions', { id: randomUUID(), user_id: a.id, reward_id: rewardId, coins_spent: 100 }],
    ['subscriptions', { user_id: a.id, plan: 'pro_monthly', source: 'mock_payment', status: 'active', current_period_end: periodEnd }],
  ];
  for (const [table, row] of forbiddenInserts) {
    await check(`authenticated user cannot POST ${table}`, async () => {
      requirePrivilegeDenial(await request(`rest/v1/${table}`, a.credentials, { method: 'POST', body: row }));
    });
  }
  await check('service role can read the existing gym secret', async () => {
    const rows = await readRows('gyms', service, { id: `eq.${gymId}`, select: 'id,qr_secret' });
    ensure(rows.length === 1 && typeof rows[0].qr_secret === 'string' && rows[0].qr_secret.length > 0, 'The secret fixture is not readable by service role.');
  });
  await check('authenticated user cannot select gyms.qr_secret', async () => {
    requirePrivilegeDenial(await request(tablePath('gyms', { id: `eq.${gymId}`, select: 'qr_secret' }), a.credentials));
  });
  for (const [label, credentials] of [['anonymous', anon], ['authenticated', a.credentials]]) {
    await check(`${label} user cannot call redeem_reward`, async () => {
      requirePrivilegeDenial(await request('rest/v1/rpc/redeem_reward', credentials, {
        method: 'POST', body: { p_user_id: a.id, p_reward_id: rewardId },
      }));
    });
  }
  await check('denied requests leave user A non-Pro with only the original ledger credit', async () => {
    const profile = await readRows('profiles', service, { id: `eq.${a.id}`, select: 'id,is_pro' });
    const ledger = await readRows('coin_ledger', service, { user_id: `eq.${a.id}`, select: 'amount,reason' });
    ensure(profile.length === 1 && profile[0].is_pro === false, 'A denied request changed is_pro.');
    ensure(ledger.length === 1 && ledger[0].amount === 200 && ledger[0].reason === 'smoke_credit', 'A denied request changed the ledger.');
  });
  for (const table of ['gym_checkins', 'redemptions', 'subscriptions']) {
    await check(`denied requests leave no ${table} rows for user A`, async () => {
      const rows = await readRows(table, service, { user_id: `eq.${a.id}`, select: 'user_id' });
      ensure(rows.length === 0, 'An unauthorized request inserted a row.');
    });
  }
}

try {
  await main();
} catch (error) {
  if (!(error instanceof SetupFailure)) {
    failed += 1;
    console.error('FAIL: the smoke test stopped unexpectedly; sensitive error details were suppressed.');
  }
} finally {
  await cleanup();
  for (const user of users) {
    user.password = undefined;
    user.credentials = undefined;
  }
}

console.log(`${failed === 0 ? 'PASS' : 'FAIL'}: PostgREST smoke test completed (${passed} passed, ${failed} failed).`);
process.exitCode = failed === 0 ? 0 : 1;
