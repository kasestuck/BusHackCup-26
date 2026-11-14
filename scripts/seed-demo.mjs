#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { addCalendarDays, isoWeekday, localDateAt, weekStartDate } from '../lib/server/time.ts';

export class DemoSeedError extends Error {}
const PROFILE = Object.freeze({
  height_cm: 175, weight_kg: 75, age: 30, goal: 'general_fitness',
  workout_types: ['gym_strength'], equipment: ['full_gym'], session_minutes: 45,
  weekdays: [1, 3, 5], injuries: [], timezone: 'America/Chicago', display_name: 'Demo Athlete',
});
function ensure(condition, message) { if (!condition) throw new DemoSeedError(message); }
function configuration(env) {
  for (const name of ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'DEMO_EMAIL', 'DEMO_PASSWORD', 'DEMO2_EMAIL']) {
    ensure(typeof env[name] === 'string' && env[name].trim(), `Set ${name} before running the demo seed.`);
  }
  let url;
  try { url = new URL(env.SUPABASE_URL); } catch { throw new DemoSeedError('SUPABASE_URL must be a valid project origin.'); }
  ensure(url.protocol === 'https:' || (url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)), 'Use HTTPS except for a local test server.');
  ensure(!url.username && !url.password && !url.search && !url.hash && url.pathname === '/', 'SUPABASE_URL must contain only the project origin.');
  const emails = [env.DEMO_EMAIL.trim().toLowerCase(), env.DEMO2_EMAIL.trim().toLowerCase()];
  ensure(emails.every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) && emails[0] !== emails[1], 'Provide two distinct valid demo email addresses.');
  ensure(env.DEMO_PASSWORD.length >= 8, 'DEMO_PASSWORD must contain at least eight characters.');
  return { origin: url.origin, key: env.SUPABASE_SERVICE_ROLE_KEY, emails, password: env.DEMO_PASSWORD };
}
function client(config, fetchImpl) {
  return async (path, { method = 'GET', body } = {}) => {
    const headers = { apikey: config.key, Accept: 'application/json' };
    if (!config.key.startsWith('sb_')) headers.Authorization = `Bearer ${config.key}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetchImpl(new URL(path, config.origin), { method, headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000), redirect: 'error' });
    } catch { throw new DemoSeedError('A demo seed request failed or timed out.'); }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new DemoSeedError(`A demo seed request failed with HTTP ${response.status}.`);
    }
    if (response.status === 204) return null;
    try { return await response.json(); } catch { throw new DemoSeedError('A demo seed response had invalid JSON.'); }
  };
}
function stablePlanId(userId) {
  const bytes = createHash('sha256').update(`showup-demo-seed-v1:${userId}`).digest().subarray(0, 16);
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const value = bytes.toString('hex');
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}
async function findUsers(request, emails) {
  const found = new Map();
  for (let page = 1; page <= 200; page += 1) {
    const response = await request(`/auth/v1/admin/users?page=${page}&per_page=1000`);
    ensure(Array.isArray(response.users), 'The Auth user listing had an unexpected shape.');
    for (const user of response.users) if (emails.includes(user.email?.toLowerCase())) found.set(user.email.toLowerCase(), user);
    if (response.users.length < 1000 || found.size === 2) return found;
  }
  throw new DemoSeedError('The Auth user listing exceeded the supported demo scan size.');
}
async function readCatalog(request) {
  const rows = [];
  for (let offset = 0; offset < 100000; offset += 1000) {
    const query = new URLSearchParams({ select: 'slug,name,muscle_group,equipment,contraindicated_for,video_youtube_id,video_title,verified',
      verified: 'eq.true', order: 'slug', limit: '1000', offset: String(offset) });
    query.append('video_youtube_id', 'not.is.null');
    query.append('video_youtube_id', 'neq.');
    const page = await request(`/rest/v1/exercises?${query}`);
    ensure(Array.isArray(page), 'The exercise catalog response had an unexpected shape.');
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
  throw new DemoSeedError('The exercise catalog exceeded the supported demo scan size.');
}
function hasQuestionnaire(profile) {
  return profile && (['age', 'height_cm', 'weight_kg', 'goal', 'session_minutes'].some(key => profile[key] != null)
    || ['weekdays', 'equipment', 'workout_types', 'injuries'].some(key => Array.isArray(profile[key]) && profile[key].length > 0));
}
export async function runDemoSeed({ argv = process.argv.slice(2), env = process.env, fetchImpl = globalThis.fetch, log = console.log, now = new Date() } = {}) {
  ensure(argv.every(arg => ['--dry-run', '--help'].includes(arg)), 'Usage: node --use-system-ca scripts/seed-demo.mjs [--dry-run]');
  if (argv.includes('--help')) {
    log('Usage: node --use-system-ca scripts/seed-demo.mjs [--dry-run]');
    log('Environment: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_EMAIL, DEMO_PASSWORD, DEMO2_EMAIL.');
    return;
  }
  if (argv.includes('--dry-run')) {
    log('PASS: demo seed dry run; two accounts, three scheduled days, 45 minutes, full gym, America/Chicago.');
    log('PASS: no network requests or writes; live verified catalog readiness was not checked.');
    return { dry_run: true, accounts: 2, checkins: 3, sessions: 3 };
  }
  const config = configuration(env);
  const request = client(config, fetchImpl);
  const { preparePlanCatalog, fallbackPlan, CatalogUnavailableError } = await import('../lib/server/plans.ts');
  const { QuestionnaireSchema } = await import('../lib/server/contract.ts');
  const { timezone, display_name, ...input } = PROFILE;
  const questionnaire = QuestionnaireSchema.parse(input);
  let catalog;
  try { catalog = preparePlanCatalog(questionnaire, await readCatalog(request)); }
  catch (error) {
    if (error instanceof CatalogUnavailableError) throw new DemoSeedError('Not enough manually verified exercises are available for a 45-minute demo plan. No accounts or data were created.');
    throw error;
  }
  const gyms = await request('/rest/v1/gyms?select=id&timezone=eq.America%2FChicago&order=id&limit=1');
  ensure(Array.isArray(gyms) && gyms.length === 1, 'Seed a gym in America/Chicago before the demo seed. No accounts or data were created.');
  const users = await findUsers(request, config.emails);
  const second = users.get(config.emails[1]);
  if (second) {
    const profiles = await request(`/rest/v1/profiles?select=age,height_cm,weight_kg,goal,session_minutes,weekdays,equipment,workout_types,injuries&id=eq.${encodeURIComponent(second.id)}`);
    ensure(Array.isArray(profiles) && profiles.length === 1 && !hasQuestionnaire(profiles[0]), 'The second demo account already has a questionnaire; use an account with an empty profile.');
  }
  const created = [];
  let committed = false;
  try {
    for (const email of config.emails) {
      if (users.has(email)) continue;
      const id = randomUUID();
      // Track our UUID before the request so a lost response can still be cleaned up.
      created.push(id);
      const user = await request('/auth/v1/admin/users', { method: 'POST', body: {
        id, email, password: config.password, email_confirm: true,
      } });
      ensure(user.id === id, 'The created Auth user had an unexpected identity.');
      users.set(email, user);
    }
    const primary = users.get(config.emails[0]);
    const plan = fallbackPlan(questionnaire, catalog, stablePlanId(primary.id));
    const lastMonday = addCalendarDays(weekStartDate(localDateAt(now, timezone)), -7);
    const events = plan.days.map((day, day_index) => {
      const localDate = addCalendarDays(lastMonday, day.weekday - 1);
      ensure(isoWeekday(localDate) === day.weekday, 'The demo schedule is inconsistent.');
      return { day_index, completed_at: `${localDate}T18:00:00.000Z`, exercises: day.exercises.map(exercise => ({
        slug: exercise.slug, sets: Array.from({ length: exercise.sets }, () => ({ reps: 8, weight_kg: 0 })),
      })) };
    });
    const result = await request('/rest/v1/rpc/seed_demo_account', { method: 'POST', body: {
      p_user_id: primary.id, p_plan: plan, p_profile: { ...questionnaire, timezone, display_name }, p_gym_id: gyms[0].id, p_events: events,
    } });
    committed = true;
    ensure(['plans', 'checkins', 'sessions', 'ledger_entries'].every(key => Number.isSafeInteger(result[key]) && result[key] >= 0), 'The demo seed summary had an unexpected shape.');
    log(`PASS: demo accounts ready; created=${created.length}; plans=${result.plans}; checkins=${result.checkins}; sessions=${result.sessions}; ledger_entries=${result.ledger_entries}.`);
    log('PASS: deterministic plan and history persisted without AI; the second account has no questionnaire.');
    return { accounts: 2, created_accounts: created.length, ...result };
  } catch (error) {
    if (!committed) {
      for (const id of created.reverse()) {
        try { await request(`/auth/v1/admin/users/${id}`, { method: 'DELETE' }); }
        catch { log('FAIL: cleanup of a newly created demo account could not be confirmed; inspect Auth users before rerunning.'); }
      }
    }
    throw error;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (!process.execArgv.includes('--conditions=react-server') && !process.argv.includes('--dry-run') && !process.argv.includes('--help')) {
    const result = spawnSync(process.execPath, ['--use-system-ca', '--conditions=react-server', fileURLToPath(import.meta.url), ...process.argv.slice(2)], {
      env: process.env, stdio: 'inherit', windowsHide: true,
    });
    if (result.error) console.error('The demo seed server process could not start.');
    process.exitCode = result.status ?? 1;
  } else {
    runDemoSeed().catch(error => {
      console.error(error instanceof DemoSeedError ? error.message : 'The demo seed failed unexpectedly; private details were suppressed.');
      process.exitCode = 1;
    });
  }
}
