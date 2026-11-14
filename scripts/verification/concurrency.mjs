/**
 * Real PostgreSQL concurrency test. Requires pg and an empty, disposable database
 * with Supabase auth roles/schema and the project migration already applied.
 * Use an administrator connection, not a PostgREST URL or a pooled HTTP client.
 *
 * PowerShell:
 *   $env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:54322/postgres"
 *   $env:TEST_DATABASE_DISPOSABLE = "1"
 *   node scripts/verification/concurrency.mjs
 *
 * The test commits its own randomly identified fixtures and removes only those
 * fixtures in finally. A terminated process can leave those fixtures behind.
 * It refuses databases that already contain profiles. It does not apply migrations.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import pg from 'pg';

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString || process.env.TEST_DATABASE_DISPOSABLE !== '1') {
  throw new Error('Set TEST_DATABASE_URL and TEST_DATABASE_DISPOSABLE=1 for an empty disposable database.');
}

const { Client } = pg;
const clients = [];
const userId = randomUUID();
const rewardId = randomUUID();
const creditId = randomUUID();
const partnerId = randomUUID();
const gymId = randomUUID();
const planId = randomUUID();
const quotaUserId = randomUUID();
let coordinator;
let first;
let second;
let fixturesCommitted = false;
let pendingSecond;
let failure;

async function connect(label) {
  const client = new Client({
    connectionString,
    application_name: `showup_concurrency_${label}`,
    connectionTimeoutMillis: 5000,
    statement_timeout: 20000,
    idle_in_transaction_session_timeout: 30000,
  });
  await client.connect();
  clients.push(client);
  return client;
}

async function beginAsServiceRole(client) {
  await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
  await client.query('SET LOCAL ROLE service_role');
  const role = await client.query('SELECT current_user AS role');
  assert.equal(role.rows[0].role, 'service_role');
}

async function runContended(query, values, label) {
  const firstPid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const secondPid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.notEqual(firstPid, secondPid, 'The test requires independent PostgreSQL connections.');
  await beginAsServiceRole(first);
  const firstOutcome = await first.query(query, values);
  await beginAsServiceRole(second);
  let secondSettled = false;
  pendingSecond = second.query(query, values)
    .then(result => ({ result }), error => ({ error }))
    .finally(() => { secondSettled = true; });
  let observedLock = false;
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && !secondSettled) {
    const activity = await coordinator.query(`
      SELECT wait_event_type,
             $1::integer = ANY(pg_catalog.pg_blocking_pids(pid)) AS blocked_by_first
      FROM pg_catalog.pg_stat_activity WHERE pid = $2
    `, [firstPid, secondPid]);
    if (activity.rows[0]?.wait_event_type === 'Lock' && activity.rows[0].blocked_by_first) {
      observedLock = true;
      break;
    }
    await delay(25);
  }
  assert.equal(observedLock, true, `${label}: the second call must wait for the first transaction lock.`);
  assert.equal(secondSettled, false, `${label}: the second call must remain blocked before COMMIT.`);
  console.log(`PASS: ${label} uses independent service-role connections contending on the user lock.`);
  await first.query('COMMIT');
  const secondOutcome = await pendingSecond;
  await second.query(secondOutcome.error ? 'ROLLBACK' : 'COMMIT');
  pendingSecond = undefined;
  return { first: firstOutcome.rows[0].result, second: secondOutcome };
}

try {
  coordinator = await connect('coordinator');
  const privilege = await coordinator.query(`
    SELECT rolsuper OR rolbypassrls AS can_audit
    FROM pg_catalog.pg_roles WHERE rolname = current_user
  `);
  assert.equal(privilege.rows[0]?.can_audit, true, 'The test requires a database administrator that can bypass RLS.');
  const existing = await coordinator.query('SELECT count(*)::integer AS count FROM public.profiles');
  assert.equal(existing.rows[0].count, 0, 'The test requires an empty disposable database with no profiles.');
  const functions = await coordinator.query(`
    SELECT to_regprocedure('public.redeem_reward(uuid,uuid)') IS NOT NULL AS redeem,
           to_regprocedure('public.coin_balance(uuid)') IS NOT NULL AS balance
  `);
  assert.equal(functions.rows[0].redeem && functions.rows[0].balance, true, 'Apply the project migration before this test.');

  // Fixtures must be committed before both independent sessions can see them.
  await coordinator.query('BEGIN');
  await coordinator.query('INSERT INTO auth.users (id) VALUES ($1)', [userId]);
  await coordinator.query('INSERT INTO auth.users (id) VALUES ($1)', [quotaUserId]);
  await coordinator.query('UPDATE public.profiles SET display_name = $2, timezone = $3, weekdays = ARRAY[1,3] WHERE id = $1',
    [userId, 'Concurrency verification', 'America/New_York']);
  await coordinator.query(`
    INSERT INTO public.rewards (id, kind, title, cost_coins)
    VALUES ($1, 'pro_month', 'Concurrency verification reward', 100)
  `, [rewardId]);
  await coordinator.query(`
    INSERT INTO public.coin_ledger (id, user_id, amount, reason, ref_id)
    VALUES ($1, $2, 100, 'verification_credit', $3)
  `, [creditId, userId, creditId]);
  await coordinator.query(`
    INSERT INTO public.partners(id, name, type, commission_pct, ref_slug)
    VALUES ($1, 'Concurrency partner', 'gym', 0, $2)
  `, [partnerId, `concurrency-${partnerId}`]);
  await coordinator.query(`
    INSERT INTO public.gyms(id, name, city, address, qr_secret, partner_id, timezone)
    VALUES ($1, 'Concurrency gym', 'Test City', 'Test Address', 'test-only-secret', $2, 'America/New_York')
  `, [gymId, partnerId]);
  await coordinator.query(`
    INSERT INTO public.workout_plans(id, user_id, input_snapshot, plan_json)
    VALUES ($1, $2, '{}', '{"days":[{"weekday":1,"exercises":[{"slug":"test-lift"}]}]}')
  `, [planId, userId]);
  await coordinator.query('COMMIT');
  fixturesCommitted = true;

  first = await connect('first');
  second = await connect('second');
  const redeemed = await runContended('SELECT public.redeem_reward($1, $2) AS result', [userId, rewardId], 'redemption');
  assert.equal(redeemed.first.balance, 0);
  assert.ok(redeemed.first.pro_until);
  assert.equal(redeemed.second.error?.code, 'P0001');
  assert.equal(redeemed.second.error?.message, 'not_enough_coins');
  console.log('PASS: the waiting redemption observes the committed debit and rejects insufficient funds.');

  const final = await coordinator.query(`
    SELECT public.coin_balance($1) AS balance,
           (SELECT count(*)::integer FROM public.coin_ledger WHERE user_id = $1) AS ledger_rows,
           (SELECT count(*)::integer FROM public.coin_ledger WHERE user_id = $1 AND amount < 0) AS debits,
           (SELECT count(*)::integer FROM public.redemptions WHERE user_id = $1) AS redemptions,
           (SELECT count(*)::integer FROM public.subscriptions WHERE user_id = $1 AND status = 'active') AS subscriptions,
           (SELECT is_pro FROM public.profiles WHERE id = $1) AS is_pro
  `, [userId]);
  assert.deepEqual(final.rows[0], {
    balance: '0', ledger_rows: 2, debits: 1, redemptions: 1, subscriptions: 1, is_pro: true,
  });
  console.log('PASS: final balance is zero, with exactly one debit, one redemption and one Pro subscription.');

  // Exercise the overload used by HTTP independently of the legacy RPC above.
  await coordinator.query(`
    INSERT INTO public.coin_ledger(user_id, amount, reason, ref_id)
    VALUES ($1, 100, 'commerce_concurrency_credit', $2)
  `, [userId, randomUUID()]);
  const commerceRedeemed = await runContended('SELECT public.redeem_reward($1, $2, $3::text[]) AS result',
    [userId, rewardId, []], 'HTTP redemption overload');
  assert.equal(commerceRedeemed.first.balance, 0);
  assert.equal(commerceRedeemed.second.error?.code, 'P0001');
  assert.equal(commerceRedeemed.second.error?.message, 'not_enough_coins');
  assert.equal(commerceRedeemed.second.error?.detail, '100');
  const commerceFinal = await coordinator.query(`
    SELECT public.coin_balance($1) AS balance,
           (SELECT count(*)::integer FROM public.coin_ledger WHERE user_id = $1 AND amount < 0) AS debits,
           (SELECT count(*)::integer FROM public.redemptions WHERE user_id = $1) AS redemptions,
           (SELECT source FROM public.subscriptions WHERE user_id = $1) AS source
  `, [userId]);
  assert.deepEqual(commerceFinal.rows[0], {balance: '0', debits: 2, redemptions: 2, source: 'coin_redemption'});
  console.log('PASS: concurrent HTTP redemptions issue exactly one new debit and redemption; the loser receives an exact shortfall.');

  const existingProEnd = (await coordinator.query('SELECT current_period_end FROM public.subscriptions WHERE user_id=$1', [userId])).rows[0].current_period_end;
  const subscribed = await runContended('SELECT public.mock_subscribe($1) AS result', [userId], 'mock subscribe');
  assert.equal(subscribed.second.error, undefined);
  assert.equal(new Date(subscribed.first.pro_until).getTime(), existingProEnd.getTime());
  assert.deepEqual(subscribed.second.result.rows[0].result, subscribed.first);
  console.log('PASS: concurrent mock subscription clicks both return the existing expiry without extension.');

  const checkins = await runContended('SELECT public.record_gym_checkin($1, $2, $3) AS result',
    [userId, gymId, '2026-11-16T15:00:00Z'], 'check-in');
  assert.deepEqual(checkins.first, { coins_earned: 40, balance: 40 });
  assert.equal(checkins.second.error?.code, 'P0001');
  assert.equal(checkins.second.error?.message, 'already_checked_in');
  const checked = await coordinator.query(`
    SELECT (SELECT count(*)::integer FROM public.gym_checkins WHERE user_id = $1) AS checkins,
           (SELECT count(*)::integer FROM public.coin_ledger WHERE user_id = $1 AND reason = 'gym_checkin') AS rewards,
           public.coin_balance($1) AS balance
  `, [userId]);
  assert.deepEqual(checked.rows[0], { checkins: 1, rewards: 1, balance: '40' });
  console.log('PASS: concurrent check-ins create one row, one +40 reward and one already_checked_in conflict.');

  const sessionLog = JSON.stringify([{ slug: 'test-lift', sets: [{ reps: 8, weight_kg: 0 }] }]);
  const sessions = await runContended('SELECT public.record_workout_session($1, $2, $3, $4::jsonb, $5) AS result',
    [userId, planId, 0, sessionLog, '2026-11-16T15:00:00Z'], 'workout');
  assert.deepEqual(sessions.first, { xp_earned: 5, coins_earned: 10, balance: 50 });
  assert.equal(sessions.second.error, undefined);
  assert.deepEqual(sessions.second.result.rows[0].result, { xp_earned: 5, coins_earned: 0, balance: 50 });
  const trained = await coordinator.query(`
    SELECT (SELECT count(*)::integer FROM public.workout_sessions WHERE user_id = $1) AS sessions,
           (SELECT count(*)::integer FROM public.coin_ledger WHERE user_id = $1 AND reason = 'workout_session') AS rewards,
           public.coin_balance($1) AS balance
  `, [userId]);
  assert.deepEqual(trained.rows[0], { sessions: 2, rewards: 1, balance: '50' });
  console.log('PASS: concurrent workouts both persist with XP, but exactly one +10 daily reward is issued.');

  const reservations = await runContended('SELECT public.reserve_plan_generation($1) AS result',
    [quotaUserId], 'Free generation quota');
  assert.match(reservations.first, /^[0-9a-f-]{36}$/);
  assert.equal(reservations.second.error?.code, 'P0001');
  assert.equal(reservations.second.error?.message, 'pro_required');
  const attempts = await coordinator.query(`
    SELECT count(*)::integer AS attempts FROM app_private.plan_generation_attempts WHERE user_id = $1
  `, [quotaUserId]);
  assert.equal(attempts.rows[0].attempts, 1);
  console.log('PASS: concurrent Free generation requests reserve exactly one attempt; the loser receives pro_required.');
} catch (error) {
  failure = error;
} finally {
  // Releasing the first lock lets any outstanding second query finish or fail.
  if (first) await first.query('ROLLBACK').catch(() => {});
  if (pendingSecond) await pendingSecond;
  if (second) await second.query('ROLLBACK').catch(() => {});
  if (coordinator) {
    try {
      await coordinator.query('ROLLBACK');
      if (fixturesCommitted) {
        await coordinator.query('BEGIN');
        // The profile FK cascades only rows belonging to this random test user.
        await coordinator.query('DELETE FROM auth.users WHERE id = $1', [userId]);
        await coordinator.query('DELETE FROM auth.users WHERE id = $1', [quotaUserId]);
        await coordinator.query('DELETE FROM public.rewards WHERE id = $1', [rewardId]);
        await coordinator.query('DELETE FROM public.gyms WHERE id = $1', [gymId]);
        await coordinator.query('DELETE FROM public.partners WHERE id = $1', [partnerId]);
        await coordinator.query('COMMIT');
        console.log('PASS: test fixtures removed.');
      }
    } catch (cleanupError) {
      failure ??= cleanupError;
      console.error(`Fixture cleanup failed. Test user: ${userId}; test reward: ${rewardId}.`);
    }
  }
  await Promise.allSettled(clients.map(client => client.end()));
}

if (failure) {
  console.error(`FAIL: ${failure.message}`);
  process.exitCode = 1;
} else {
  console.log('PASS: real PostgreSQL concurrency verification completed.');
}
