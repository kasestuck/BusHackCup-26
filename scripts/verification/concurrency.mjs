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
  await coordinator.query('INSERT INTO public.profiles (id, display_name) VALUES ($1, $2)', [userId, 'Concurrency verification']);
  await coordinator.query(`
    INSERT INTO public.rewards (id, kind, title, cost_coins)
    VALUES ($1, 'pro_month', 'Concurrency verification reward', 100)
  `, [rewardId]);
  await coordinator.query(`
    INSERT INTO public.coin_ledger (id, user_id, amount, reason, ref_id)
    VALUES ($1, $2, 100, 'verification_credit', $3)
  `, [creditId, userId, creditId]);
  await coordinator.query('COMMIT');
  fixturesCommitted = true;

  first = await connect('first');
  second = await connect('second');
  const firstPid = (await first.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  const secondPid = (await second.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  assert.notEqual(firstPid, secondPid, 'The test requires independent PostgreSQL connections.');

  await beginAsServiceRole(first);
  const redeemed = await first.query('SELECT public.redeem_reward($1, $2) AS result', [userId, rewardId]);
  assert.equal(redeemed.rows[0].result.balance, 0);
  assert.ok(redeemed.rows[0].result.pro_until);
  // Keep the successful debit uncommitted and its profile lock held.
  await beginAsServiceRole(second);
  let secondSettled = false;
  pendingSecond = second.query('SELECT public.redeem_reward($1, $2) AS result', [userId, rewardId])
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
  assert.equal(observedLock, true, 'The second redemption must wait for the first transaction lock.');
  assert.equal(secondSettled, false, 'The second redemption must remain blocked until the first transaction ends.');
  console.log('PASS: independent service-role connections contend on the same user lock.');

  await first.query('COMMIT');
  const secondOutcome = await pendingSecond;
  assert.equal(secondOutcome.error?.code, 'P0001', 'The second redemption must fail after the first commit.');
  assert.equal(secondOutcome.error?.message, 'not_enough_coins');
  await second.query('ROLLBACK');
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
        await coordinator.query('DELETE FROM public.rewards WHERE id = $1', [rewardId]);
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
