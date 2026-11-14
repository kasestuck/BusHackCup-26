import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

if (!process.execArgv.includes('--conditions=react-server')) {
  test('demo seed executes its HTTP tests under the server condition', () => {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    const child = spawnSync(process.execPath, ['--use-system-ca', '--conditions=react-server', '--test', '--test-reporter=tap', fileURLToPath(import.meta.url)], {
      env, encoding: 'utf8', timeout: 30000, windowsHide: true,
    });
    assert.equal(child.error, undefined);
    assert.equal(child.status, 0, child.stdout + child.stderr);
    assert.match(child.stdout, /^# tests 5$/m);
    assert.match(child.stdout, /^# pass 5$/m);
    assert.match(child.stdout, /^# fail 0$/m);
    assert.doesNotMatch(child.stderr, /recursively|skipping running files/);
  });
} else {
  const { runDemoSeed, DemoSeedError } = await import('./seed-demo.mjs');
  const { PlanSchema } = await import('../lib/server/contract.ts');
  const { fallbackPlan, preparePlanCatalog } = await import('../lib/server/plans.ts');
  // Synthetic schema fixtures are never seeded or represented as reviewed public videos.
  const catalog = Array.from({ length: 6 }, (_, index) => ({
    slug: `demo-test-exercise-${index}`, name: `Test exercise ${index}`,
    muscle_group: ['upper', 'lower', 'core'][index % 3], equipment: 'full_gym',
    contraindicated_for: [], video_youtube_id: 'abcdefghijk', video_title: 'Synthetic test metadata', verified: true,
  }));
  const blank = () => ({ age: null, height_cm: null, weight_kg: null, goal: null, session_minutes: null,
    weekdays: [], workout_types: [], equipment: [], injuries: [] });
  async function withFake(context, scenario, action) {
    const config = { DEMO_EMAIL: `${randomUUID()}@example.invalid`, DEMO2_EMAIL: `${randomUUID()}@example.invalid`,
      DEMO_PASSWORD: randomBytes(24).toString('base64url'), SUPABASE_SERVICE_ROLE_KEY: randomBytes(24).toString('hex') };
    const state = { users: [], profiles: new Map(), plans: new Map(), checkins: [], sessions: [], ledger: [],
      mutations: 0, requests: 0, payload: null, logs: [] };
    if (scenario.existingSecond) {
      const second = { id: randomUUID(), email: config.DEMO2_EMAIL };
      state.users.push(second);
      state.profiles.set(second.id, { ...blank(), age: 30 });
    }
    const reply = (response, status, value) => {
      response.writeHead(status, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify(value));
    };
    const server = createServer((request, response) => {
      void (async () => {
        state.requests += 1;
        const url = new URL(request.url, 'http://localhost');
        const chunks = [];
        for await (const chunk of request) chunks.push(chunk);
        const raw = Buffer.concat(chunks).toString('utf8');
        const body = raw ? JSON.parse(raw) : null;
        if (request.method !== 'GET') state.mutations += 1;
        assert.ok(request.headers.apikey === config.SUPABASE_SERVICE_ROLE_KEY, 'The server client must use the configured key.');
        if (url.pathname === '/rest/v1/exercises') return reply(response, 200, scenario.emptyCatalog ? [] : catalog);
        if (url.pathname === '/rest/v1/gyms') return reply(response, 200, [{ id: '20000000-0000-4000-8000-000000000001' }]);
        if (url.pathname === '/auth/v1/admin/users' && request.method === 'GET') return reply(response, 200, { users: state.users });
        if (url.pathname === '/auth/v1/admin/users' && request.method === 'POST') {
          assert.ok(body.email_confirm === true && body.password === config.DEMO_PASSWORD, 'New users must have confirmed email and the configured password.');
          const user = { id: body.id, email: body.email };
          state.users.push(user); state.profiles.set(user.id, blank());
          return reply(response, 200, user);
        }
        if (url.pathname.startsWith('/auth/v1/admin/users/') && request.method === 'DELETE') {
          const id = url.pathname.split('/').at(-1);
          state.users = state.users.filter(user => user.id !== id); state.profiles.delete(id);
          return reply(response, 200, {});
        }
        if (url.pathname === '/rest/v1/profiles') {
          const id = url.searchParams.get('id')?.slice(3);
          return reply(response, 200, state.profiles.has(id) ? [state.profiles.get(id)] : []);
        }
        if (url.pathname === '/rest/v1/rpc/seed_demo_account') {
          if (scenario.failRpc) return reply(response, 500, { message: 'Injected fixture failure.' });
          if (!state.plans.has(body.p_plan.id)) {
            state.payload = body;
            state.profiles.set(body.p_user_id, body.p_profile);
            state.plans.set(body.p_plan.id, body.p_plan);
            state.checkins.push(...body.p_events); state.sessions.push(...body.p_events);
            state.ledger.push(20, 40, 10, 40, 10, 40, 10, 50);
          }
          return reply(response, 200, { plans: state.plans.size, checkins: state.checkins.length,
            sessions: state.sessions.length, ledger_entries: state.ledger.length });
        }
        return reply(response, 500, { message: 'Unexpected fixture request.' });
      })().catch(() => reply(response, 500, { message: 'A fixture assertion failed.' }));
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    config.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    try { await action(state, config); }
    finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
      const output = state.logs.join('\n');
      for (const name of ['DEMO_EMAIL', 'DEMO2_EMAIL', 'DEMO_PASSWORD', 'SUPABASE_SERVICE_ROLE_KEY']) {
        assert.ok(!output.includes(config[name]), 'Seed output must not contain private configuration values.');
      }
    }
  }
  test('dry run requires no credentials and performs zero HTTP requests', async () => {
    let requests = 0;
    const result = await runDemoSeed({ argv: ['--dry-run'], env: {}, log: () => {}, fetchImpl: async () => { requests += 1; throw new Error('Network prohibited.'); } });
    assert.equal(requests, 0);
    assert.equal(result.dry_run, true);
  });
  test('an insufficient verified catalog stops before creating either account or any database data', async context => {
    await withFake(context, { emptyCatalog: true }, async (state, env) => {
      await assert.rejects(() => runDemoSeed({ argv: [], env, log: value => state.logs.push(value) }), error => error instanceof DemoSeedError && /Not enough manually verified exercises/.test(error.message));
      assert.equal(state.mutations, 0);
      assert.equal(state.users.length, 0);
      assert.equal(state.plans.size, 0);
    });
  });
  test('two live HTTP seed runs use the shared fallback and leave all row counts unchanged', async context => {
    await withFake(context, {}, async (state, env) => {
      const options = { argv: [], env, now: new Date('2026-11-14T12:00:00Z'), log: value => state.logs.push(value) };
      const first = await runDemoSeed(options);
      const payload = state.payload;
      PlanSchema.parse(payload.p_plan);
      const { timezone, display_name, ...questionnaire } = payload.p_profile;
      assert.equal(timezone, 'America/Chicago');
      assert.deepEqual(payload.p_plan, fallbackPlan(questionnaire, preparePlanCatalog(questionnaire, catalog), payload.p_plan.id));
      assert.deepEqual(payload.p_plan.days.map(day => day.weekday), [1, 3, 5]);
      assert.ok(payload.p_plan.days.every(day => day.duration_min === 45));
      assert.deepEqual(payload.p_events.map(event => event.completed_at), ['2026-11-02T18:00:00.000Z', '2026-11-04T18:00:00.000Z', '2026-11-06T18:00:00.000Z']);
      const second = await runDemoSeed({ ...options, now: new Date('2026-11-21T12:00:00Z') });
      for (const name of ['accounts', 'plans', 'checkins', 'sessions', 'ledger_entries']) assert.equal(second[name], first[name]);
      assert.equal(first.created_accounts, 2); assert.equal(second.created_accounts, 0);
      assert.equal(state.users.length, 2); assert.equal(state.plans.size, 1);
      assert.equal(state.checkins.length, 3); assert.equal(state.sessions.length, 3); assert.equal(state.ledger.length, 8);
      const secondUser = state.users.find(user => user.email === env.DEMO2_EMAIL);
      assert.deepEqual(state.profiles.get(secondUser.id), blank());
    });
  });
  test('a failed transactional RPC cleans up only newly created Auth accounts', async context => {
    await withFake(context, { failRpc: true }, async (state, env) => {
      await assert.rejects(() => runDemoSeed({ argv: [], env, log: value => state.logs.push(value) }), /HTTP 500/);
      assert.equal(state.users.length, 0); assert.equal(state.profiles.size, 0);
      assert.equal(state.plans.size, 0); assert.equal(state.ledger.length, 0);
    });
  });
  test('an existing second account with onboarding data is rejected without resetting it', async context => {
    await withFake(context, { existingSecond: true }, async (state, env) => {
      await assert.rejects(() => runDemoSeed({ argv: [], env, log: value => state.logs.push(value) }), /already has a questionnaire/);
      assert.equal(state.mutations, 0); assert.equal(state.users.length, 1);
      assert.equal([...state.profiles.values()][0].age, 30);
    });
  });
}
