-- Run after the migration as a database administrator. All fixtures roll back.
begin;

create function pg_temp.assert_true(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
    if p_condition is distinct from true then
        raise exception 'FAIL: %', p_label;
    end if;
    raise notice 'PASS: %', p_label;
end;
$$;

create function pg_temp.expect_error(p_sql text, p_state text, p_message text, p_label text)
returns void language plpgsql as $$
declare
    v_state text;
    v_message text;
begin
    begin
        execute p_sql;
    exception when others then
        get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    end;
    perform pg_temp.assert_true(
        v_state = p_state and (p_message is null or v_message = p_message), p_label
    );
end;
$$;

-- Migration 002 revokes default function EXECUTE, including for test helpers.
grant execute on function pg_temp.assert_true(boolean, text) to anon, authenticated, service_role;
grant execute on function pg_temp.expect_error(text, text, text, text) to anon, authenticated, service_role;

select pg_temp.assert_true((
    select count(*) = 13 and bool_and(relrowsecurity)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
), 'exactly 13 tables, all with RLS');

do $$
declare v_table text; v_role text;
begin
    for v_table in select tablename from pg_tables where schemaname = 'public' loop
        foreach v_role in array array['anon', 'authenticated'] loop
            perform pg_temp.assert_true(
                not has_table_privilege(v_role, 'public.' || v_table, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'),
                v_role || ' has no write privileges on ' || v_table
            );
        end loop;
    end loop;
end;
$$;

select pg_temp.assert_true(not exists (
    select 1 from pg_policies where schemaname = 'public' and cmd <> 'SELECT'
), 'no client write policy exists');
select pg_temp.assert_true(
    not has_function_privilege('anon', 'public.redeem_reward(uuid,uuid)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.redeem_reward(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.redeem_reward(uuid,uuid)', 'EXECUTE'),
    'redeem execute is service-role-only'
);
select pg_temp.assert_true(not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and column_name in ('balance', 'coins_balance')
), 'no stored coin balance column');
select pg_temp.assert_true((
    select count(*) = 3 from information_schema.columns
    where table_schema = 'public' and
      ((table_name = 'profiles' and column_name in ('equipment', 'age'))
      or (table_name = 'gyms' and column_name = 'timezone'))
), 'equipment, age and gym timezone columns exist');

insert into auth.users (id, email) values
('11111111-1111-4111-8111-111111111111', 'sql-check-a@example.invalid'),
('22222222-2222-4222-8222-222222222222', 'sql-check-b@example.invalid');
set local role service_role;
select pg_temp.assert_true((select count(*) = 2 from public.profiles),
    'Auth insert automatically creates profiles');
insert into public.partners(id, name, type, commission_pct, ref_slug) values
('33333333-3333-4333-8333-333333333333', 'Verification Partner', 'supplements', 15, 'verification-partner');
insert into public.gyms(id, name, city, address, qr_secret, partner_id, timezone) values
('44444444-4444-4444-8444-444444444444', 'Verification Gym', 'Test City', 'Test Address', 'test-only-secret',
 '33333333-3333-4333-8333-333333333333', 'America/New_York');
select pg_temp.expect_error(
    $$update public.gyms set timezone = 'Invalid/Zone' where id = '44444444-4444-4444-8444-444444444444'$$,
    '23514', 'Invalid gym timezone.', 'invalid gym timezone rejected'
);
insert into public.workout_plans(id, user_id, input_snapshot, plan_json) values
('55555555-5555-4555-8555-555555555555', '11111111-1111-4111-8111-111111111111', '{}', '{}'),
('66666666-6666-4666-8666-666666666666', '22222222-2222-4222-8222-222222222222', '{}', '{}');
insert into public.workout_sessions(user_id, plan_id, day_index, log_json) values
('11111111-1111-4111-8111-111111111111', '55555555-5555-4555-8555-555555555555', 0, '[]'),
('22222222-2222-4222-8222-222222222222', '66666666-6666-4666-8666-666666666666', 0, '[]');
select pg_temp.expect_error(
    $$insert into public.workout_sessions(user_id, plan_id, day_index, log_json)
      values ('11111111-1111-4111-8111-111111111111', '66666666-6666-4666-8666-666666666666', 0, '[]')$$,
    '23503', null, 'session cannot reference another user plan'
);
insert into public.gym_checkins(user_id, gym_id, local_date) values
('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '2026-11-14'),
('22222222-2222-4222-8222-222222222222', '44444444-4444-4444-8444-444444444444', '2026-11-14');
select pg_temp.expect_error(
    $$insert into public.gym_checkins(user_id, gym_id, local_date)
      values ('11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444', '2026-11-14')$$,
    '23505', null, 'duplicate daily check-in rejected'
);
insert into public.coin_ledger(user_id, amount, reason, ref_id) values
('11111111-1111-4111-8111-111111111111', 20, 'first_plan', '55555555-5555-4555-8555-555555555555'),
('11111111-1111-4111-8111-111111111111', 2380, 'verification_credit', 'funding'),
('22222222-2222-4222-8222-222222222222', 700, 'verification_credit', 'funding');
select pg_temp.expect_error(
    $$insert into public.coin_ledger(user_id, amount, reason, ref_id)
      values ('11111111-1111-4111-8111-111111111111', 20, 'first_plan', 'another-plan')$$,
    '23505', null, 'first-plan reward cannot repeat with a different reference'
);
select pg_temp.expect_error(
    $$insert into public.coin_ledger(user_id, amount, reason, ref_id)
      values ('11111111-1111-4111-8111-111111111111', 2380, 'verification_credit', 'funding')$$,
    '23505', null, 'same ledger event cannot repeat'
);
select pg_temp.expect_error(
    $$insert into public.coin_ledger(user_id, amount, reason)
      values ('11111111-1111-4111-8111-111111111111', 50, 'weekly_bonus')$$,
    '23514', null, 'one-time reward requires a reference'
);
insert into public.rewards(id, kind, title, cost_coins, partner_id, discount_pct) values
('77777777-7777-4777-8777-777777777777', 'pro_month', 'Verification Pro', 1200, null, null),
('88888888-8888-4888-8888-888888888888', 'partner_product', 'Verification Discount', 500,
 '33333333-3333-4333-8333-333333333333', 15);
insert into public.food_logs(user_id, image_path, result_json) values
('11111111-1111-4111-8111-111111111111', 'verification/a.jpg', '{}'),
('22222222-2222-4222-8222-222222222222', 'verification/b.jpg', '{}');
reset role;

-- Inject a late failure after redemption and debit insertion; the entire call must roll back.
create function pg_temp.reject_subscription() returns trigger language plpgsql as $$
begin raise exception using errcode = 'P7777', message = 'Injected verification failure.'; end;
$$;
create trigger verification_reject_subscription before insert on public.subscriptions
for each row execute function pg_temp.reject_subscription();
set local role service_role;
select pg_temp.expect_error(
    $$select public.redeem_reward('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777')$$,
    'P7777', 'Injected verification failure.', 'late subscription failure propagates'
);
select pg_temp.assert_true(
    public.coin_balance('11111111-1111-4111-8111-111111111111') = 2400
    and not exists (select 1 from public.redemptions)
    and not exists (select 1 from public.subscriptions)
    and not (select is_pro from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
    'late failure rolls back debit, redemption, subscription and is_pro'
);
reset role;
drop trigger verification_reject_subscription on public.subscriptions;

set local role service_role;
select pg_temp.assert_true((public.redeem_reward(
    '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777'
) ->> 'balance')::bigint = 1200, 'Pro redemption debits the ledger');
select set_config('verification.pro_until', (
    select current_period_end::text from public.subscriptions where user_id = '11111111-1111-4111-8111-111111111111'
), true);
select pg_temp.assert_true((public.redeem_reward(
    '11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777'
) ->> 'balance')::bigint = 0, 'second funded Pro redemption succeeds');
select pg_temp.assert_true((
    select current_period_end = current_setting('verification.pro_until')::timestamptz + interval '30 days'
      and source = 'coins' and status = 'active'
    from public.subscriptions where user_id = '11111111-1111-4111-8111-111111111111'
) and (select is_pro from public.profiles where id = '11111111-1111-4111-8111-111111111111'),
'Pro expiry extends by 30 days and profile is updated');
select pg_temp.expect_error(
    $$select public.redeem_reward('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777')$$,
    'P0001', 'not_enough_coins', 'unfunded redemption fails'
);
select pg_temp.assert_true(
    public.coin_balance('11111111-1111-4111-8111-111111111111') = 0
    and (select count(*) from public.redemptions where user_id = '11111111-1111-4111-8111-111111111111') = 2,
    'unfunded redemption leaves balance and redemptions unchanged'
);
select pg_temp.assert_true((public.redeem_reward(
    '22222222-2222-4222-8222-222222222222', '88888888-8888-4888-8888-888888888888'
) ->> 'promo_code') like 'SHOWUP-%', 'partner redemption issues a promo code');
select pg_temp.assert_true(public.coin_balance('22222222-2222-4222-8222-222222222222') = 200,
    'service role sees the remaining partner reward balance');
insert into public.subscriptions(user_id, plan, source, status, current_period_end)
values ('22222222-2222-4222-8222-222222222222', 'pro_monthly', 'verification', 'active', now() + interval '1 day');
insert into public.partner_sales(partner_id, redemption_id, amount_cents, commission_cents)
select '33333333-3333-4333-8333-333333333333', id, 1000, 150
from public.redemptions where user_id = '22222222-2222-4222-8222-222222222222';
select pg_temp.expect_error(
    $$select public.redeem_reward('11111111-1111-4111-8111-111111111111', '99999999-9999-4999-8999-999999999999')$$,
    'P0001', 'reward_not_found', 'missing reward rejected'
);
select pg_temp.expect_error(
    $$update public.coin_ledger set amount = 1$$,
    '42501', null, 'service role cannot rewrite ledger history'
);
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
set local role authenticated;
select pg_temp.assert_true((select count(*) = 1 from public.profiles), 'authenticated reads only own profile');
do $$
declare v_table text; v_count bigint; v_expected bigint;
begin
    foreach v_table in array array['workout_plans','workout_sessions','gym_checkins','coin_ledger','redemptions','subscriptions','food_logs'] loop
        execute format('select count(*) from public.%I where user_id <> auth.uid()', v_table) into v_count;
        perform pg_temp.assert_true(v_count = 0, 'RLS hides other users in ' || v_table);
        execute format('select count(*) from public.%I where user_id = auth.uid()', v_table) into v_count;
        perform pg_temp.assert_true(v_count > 0, 'RLS permits own rows in ' || v_table);
    end loop;
end;
$$;
select pg_temp.assert_true(public.coin_balance('22222222-2222-4222-8222-222222222222') = 0,
    'balance function respects caller RLS');
select pg_temp.expect_error($$update public.profiles set is_pro = false where id = auth.uid()$$,
    '42501', null, 'authenticated cannot change own is_pro');
select pg_temp.expect_error($$insert into public.coin_ledger(user_id, amount, reason) values (auth.uid(), 9999, 'forged')$$,
    '42501', null, 'authenticated cannot mint coins');
select pg_temp.expect_error($$select public.redeem_reward(auth.uid(), '77777777-7777-4777-8777-777777777777')$$,
    '42501', null, 'authenticated cannot call redeem directly');
select pg_temp.expect_error($$select qr_secret from public.gyms$$,
    '42501', null, 'gym secret is hidden from authenticated');
select pg_temp.expect_error($$select id, name, city, address from public.gyms$$,
    '42501', null, 'gym catalog is read through server routes only');
select pg_temp.expect_error($$select * from public.partner_sales$$,
    '42501', null, 'partner sales are server-only');
reset role;

set local role anon;
select pg_temp.expect_error($$select * from public.profiles$$, '42501', null, 'anon cannot read user data');
select pg_temp.expect_error($$update public.profiles set is_pro = true$$, '42501', null, 'anon cannot set is_pro');
select pg_temp.expect_error($$insert into public.coin_ledger(user_id, amount, reason) values ('11111111-1111-4111-8111-111111111111', 9999, 'forged')$$,
    '42501', null, 'anon cannot mint coins');
select pg_temp.expect_error($$select public.redeem_reward('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777')$$,
    '42501', null, 'anon cannot call redeem');
reset role;

-- Activity RPC tests use independent fixtures and deterministic server timestamps.
select pg_temp.assert_true(
    not has_function_privilege('anon', 'public.record_gym_checkin(uuid,uuid,timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_gym_checkin(uuid,uuid,timestamptz)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_gym_checkin(uuid,uuid,timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)', 'EXECUTE'),
    'activity RPC execute is service-role-only'
);
select pg_temp.assert_true((
    select bool_and(not p.prosecdef and 'search_path=""' = any(p.proconfig))
    from pg_proc p where p.oid in (
        'public.record_gym_checkin(uuid,uuid,timestamptz)'::regprocedure,
        'public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)'::regprocedure
    )
), 'activity RPCs use invoker privileges and an empty search path');
select pg_temp.assert_true((
    select count(*) = 2 from pg_indexes
    where schemaname = 'public'
      and indexname in ('coin_ledger_workout_day_once', 'coin_ledger_weekly_bonus_once')
), 'explicit daily workout and weekly bonus unique indexes exist');

insert into auth.users(id, email) values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'activity-c@example.invalid'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'activity-d@example.invalid');
set local role service_role;
update public.profiles set timezone = 'Asia/Tokyo', weekdays = array[1,3]
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
update public.profiles set timezone = 'America/New_York', weekdays = '{}'
where id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
insert into public.workout_plans(id, user_id, input_snapshot, plan_json) values
('cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '{}',
 '{"days":[{"weekday":1,"exercises":[{"slug":"test-lift"},{"slug":"test-press"}]},{"weekday":3,"exercises":[{"slug":"test-lift"}]}]}'),
('dddddddd-dddd-4ddd-8ddd-dddddddddddd', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '{}',
 '{"days":[{"weekday":1,"exercises":[{"slug":"test-lift"}]}]}');

do $$
declare
    v_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    v_gym uuid := '44444444-4444-4444-8444-444444444444';
    v_result jsonb;
begin
    v_result := public.record_gym_checkin(v_user, v_gym, '2026-11-17T04:59:59Z');
    perform pg_temp.assert_true(v_result = '{"coins_earned":40,"balance":40}'::jsonb,
        'first check-in atomically awards 40 coins');
    v_result := public.record_gym_checkin(v_user, v_gym, '2026-11-17T05:00:00Z');
    perform pg_temp.assert_true(v_result = '{"coins_earned":40,"balance":80}'::jsonb,
        'gym local midnight permits the next calendar day check-in');
    perform pg_temp.assert_true((
        select array_agg(local_date order by local_date) = array['2026-11-16'::date, '2026-11-17'::date]
        from public.gym_checkins where user_id = v_user
    ), 'check-in dates use gym timezone, independently of the profile timezone');
    perform pg_temp.expect_error(format(
        'select public.record_gym_checkin(%L,%L,%L)', v_user, v_gym, '2026-11-17T16:00:00Z'
    ), 'P0001', 'already_checked_in', 'duplicate check-in returns the already_checked_in conflict');
    perform pg_temp.assert_true(public.coin_balance(v_user) = 80
        and (select count(*) = 2 from public.gym_checkins where user_id = v_user)
        and (select count(*) = 2 from public.coin_ledger where user_id = v_user and reason = 'gym_checkin'),
        'duplicate check-in creates neither a row nor extra coins');
end;
$$;

update public.profiles set timezone = 'America/New_York'
where id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

do $$
declare
    v_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    v_plan uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    v_log jsonb := '[{"slug":"test-lift","sets":[{"reps":8,"weight_kg":0},{"reps":10,"weight_kg":20}]}]';
    v_result jsonb;
    v_count bigint;
    v_bad jsonb;
begin
    v_result := public.record_workout_session(v_user, v_plan, 0, v_log, '2026-11-16T15:00:00Z');
    perform pg_temp.assert_true(v_result = '{"xp_earned":10,"coins_earned":10,"balance":90}'::jsonb,
        'first workout awards five XP per set and ten daily coins');
    v_result := public.record_workout_session(v_user, v_plan, 0, v_log, '2026-11-17T04:59:59Z');
    perform pg_temp.assert_true((v_result ->> 'coins_earned')::integer = 0
        and (select count(*) = 2 from public.workout_sessions where user_id = v_user),
        'second workout on the same profile-local day persists without another daily reward');

    select count(*) into v_count from public.workout_sessions where user_id = v_user;
    perform pg_temp.expect_error(format(
        'select public.record_workout_session(%L,%L,0,%L::jsonb,%L)',
        v_user, 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', v_log, '2026-11-18T15:00:00Z'
    ), 'P0001', 'validation_error', 'RPC rejects a workout using another user plan');
    perform pg_temp.expect_error(format(
        'select public.record_workout_session(%L,%L,2,%L::jsonb,%L)',
        v_user, v_plan, v_log, '2026-11-18T15:00:00Z'
    ), 'P0001', 'validation_error', 'RPC rejects a day index outside the plan');
    for v_bad in select value from jsonb_array_elements('[
      [{"slug":"not-in-plan","sets":[{"reps":8,"weight_kg":0}]}],
      [{"slug":"test-lift","sets":[{"reps":0,"weight_kg":0}]}],
      [{"slug":"test-lift","sets":[{"reps":101,"weight_kg":0}]}],
      [{"slug":"test-lift","sets":[{"reps":1.5,"weight_kg":0}]}],
      [{"slug":"test-lift","sets":[{"reps":8,"weight_kg":-1}]}],
      [{"slug":"test-lift","sets":[{"reps":8,"weight_kg":501}]}],
      [{"slug":"test-lift","sets":[]}],
      [{"slug":"test-lift","sets":[{"reps":8,"weight_kg":0}]},{"slug":"test-lift","sets":[{"reps":8,"weight_kg":0}]}]
    ]'::jsonb) loop
        perform pg_temp.expect_error(format(
            'select public.record_workout_session(%L,%L,0,%L::jsonb,%L)',
            v_user, v_plan, v_bad, '2026-11-18T15:00:00Z'
        ), 'P0001', 'validation_error', 'RPC rejects an invalid exercise log');
    end loop;
    perform pg_temp.assert_true((select count(*) = v_count from public.workout_sessions where user_id = v_user)
        and public.coin_balance(v_user) = 90, 'invalid workout requests leave sessions and ledger unchanged');

    v_result := public.record_workout_session(v_user, v_plan, 1, v_log, '2026-11-18T15:00:00Z');
    perform pg_temp.assert_true(v_result = '{"xp_earned":10,"coins_earned":60,"balance":150}'::jsonb,
        'completing every scheduled weekday awards the daily reward and weekly bonus atomically');
    v_result := public.record_workout_session(v_user, v_plan, 1, v_log, '2026-11-18T16:00:00Z');
    perform pg_temp.assert_true((v_result ->> 'coins_earned')::integer = 0
        and (select count(*) = 1 from public.coin_ledger where user_id = v_user and reason = 'weekly_bonus')
        and (select ref_id = '2026-11-16' from public.coin_ledger where user_id = v_user and reason = 'weekly_bonus'),
        'another completed workout cannot repeat the ISO-week bonus');
    v_result := public.record_workout_session(v_user, v_plan, 0, v_log, '2026-11-23T15:00:00Z');
    perform pg_temp.assert_true((v_result ->> 'coins_earned')::integer = 10
        and (select count(*) = 1 from public.coin_ledger where user_id = v_user and reason = 'weekly_bonus'),
        'a new ISO week does not inherit completion from the previous week');

    v_result := public.record_workout_session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'dddddddd-dddd-4ddd-8ddd-dddddddddddd', 0, v_log, '2026-11-16T15:00:00Z');
    perform pg_temp.assert_true((v_result ->> 'coins_earned')::integer = 10
        and not exists (select 1 from public.coin_ledger where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and reason = 'weekly_bonus'),
        'an empty schedule cannot earn a weekly bonus');
end;
$$;

-- Enforce workload boundaries in SQL as well as in the API validation module.
update public.workout_plans
set plan_json = jsonb_build_object('days', jsonb_build_array(jsonb_build_object(
    'weekday', 1, 'exercises', (select jsonb_agg(jsonb_build_object('slug', 'test-' || i)) from generate_series(1,21) i)
))) where id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
do $$
declare
    v_user uuid := 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    v_plan uuid := 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
    v_log jsonb;
    v_sets jsonb;
    v_result jsonb;
begin
    select jsonb_agg(jsonb_build_object('reps', 100, 'weight_kg', 500)) into v_sets from generate_series(1,10);
    select jsonb_agg(jsonb_build_object('slug', 'test-' || i, 'sets', v_sets)) into v_log from generate_series(1,6) i;
    v_result := public.record_workout_session(v_user, v_plan, 0, v_log, '2026-11-16T18:00:00Z');
    perform pg_temp.assert_true((v_result ->> 'xp_earned')::integer = 100
        and (v_result ->> 'coins_earned')::integer = 0,
        'sixty valid sets reach the XP cap without repeating daily or weekly coins');
    v_log := v_log || jsonb_build_array(jsonb_build_object('slug', 'test-7', 'sets', jsonb_build_array(jsonb_build_object('reps', 1, 'weight_kg', 0))));
    perform pg_temp.expect_error(format('select public.record_workout_session(%L,%L,0,%L::jsonb)', v_user, v_plan, v_log),
        'P0001', 'validation_error', 'sixty-one total sets are rejected');
    v_log := jsonb_build_array(jsonb_build_object('slug', 'test-1', 'sets', v_sets || jsonb_build_array(v_sets -> 0)));
    perform pg_temp.expect_error(format('select public.record_workout_session(%L,%L,0,%L::jsonb)', v_user, v_plan, v_log),
        'P0001', 'validation_error', 'eleven sets for one exercise are rejected');
    select jsonb_agg(jsonb_build_object('slug', 'test-' || i, 'sets', jsonb_build_array(jsonb_build_object('reps', 1, 'weight_kg', 0))))
    into v_log from generate_series(1,21) i;
    perform pg_temp.expect_error(format('select public.record_workout_session(%L,%L,0,%L::jsonb)', v_user, v_plan, v_log),
        'P0001', 'validation_error', 'twenty-one exercises are rejected');
end;
$$;
reset role;

-- Any failure during ledger insertion must roll back the activity row as well.
create function pg_temp.reject_activity_credit() returns trigger language plpgsql as $$
begin
    if new.reason in ('gym_checkin', 'workout_session', 'weekly_bonus') then
        raise exception using errcode = 'P7778', message = 'Injected activity ledger failure.';
    end if;
    return new;
end;
$$;
create trigger verification_reject_activity_credit before insert on public.coin_ledger
for each row execute function pg_temp.reject_activity_credit();
set local role service_role;
select pg_temp.expect_error(
    $$select public.record_gym_checkin('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','44444444-4444-4444-8444-444444444444','2026-11-20T15:00:00Z')$$,
    'P7778', 'Injected activity ledger failure.', 'check-in ledger failure propagates');
select pg_temp.assert_true(not exists (
    select 1 from public.gym_checkins where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
), 'failed check-in reward rolls back its check-in row');
select pg_temp.expect_error(
    $$select public.record_workout_session('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','dddddddd-dddd-4ddd-8ddd-dddddddddddd',0,
      '[{"slug":"test-lift","sets":[{"reps":8,"weight_kg":0}]}]','2026-11-20T15:00:00Z')$$,
    'P7778', 'Injected activity ledger failure.', 'workout ledger failure propagates');
select pg_temp.assert_true((select count(*) = 1 from public.workout_sessions where user_id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
    and public.coin_balance('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') = 10,
    'failed workout reward rolls back its session and all coins');
reset role;
drop trigger verification_reject_activity_credit on public.coin_ledger;

create or replace function pg_temp.reject_activity_credit() returns trigger language plpgsql as $$
begin
    if new.reason = 'weekly_bonus' then
        raise exception using errcode = 'P7778', message = 'Injected weekly bonus failure.';
    end if;
    return new;
end;
$$;
create trigger verification_reject_activity_credit before insert on public.coin_ledger
for each row execute function pg_temp.reject_activity_credit();
set local role service_role;
select pg_temp.expect_error(
    $$select public.record_workout_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',0,
      '[{"slug":"test-1","sets":[{"reps":8,"weight_kg":0}]}]','2026-11-25T15:00:00Z')$$,
    'P7778', 'Injected weekly bonus failure.', 'late weekly bonus failure propagates');
select pg_temp.assert_true(public.coin_balance('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') = 160
    and not exists (select 1 from public.workout_sessions where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and local_date = '2026-11-25')
    and not exists (select 1 from public.coin_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and ref_id in ('2026-11-23','2026-11-25') and reason = 'weekly_bonus')
    and not exists (select 1 from public.coin_ledger where user_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' and ref_id = '2026-11-25' and reason = 'workout_session'),
    'weekly bonus failure rolls back the preceding session and daily reward');
reset role;
drop trigger verification_reject_activity_credit on public.coin_ledger;

set local role authenticated;
select pg_temp.expect_error(
    $$select public.record_gym_checkin(auth.uid(),'44444444-4444-4444-8444-444444444444')$$,
    '42501', null, 'authenticated cannot execute check-in RPC');
select pg_temp.expect_error(
    $$select public.record_workout_session(auth.uid(),'cccccccc-cccc-4ccc-8ccc-cccccccccccc',0,'[]')$$,
    '42501', null, 'authenticated cannot execute workout RPC');
reset role;
set local role anon;
select pg_temp.expect_error(
    $$select public.record_gym_checkin('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','44444444-4444-4444-8444-444444444444')$$,
    '42501', null, 'anon cannot execute check-in RPC');
select pg_temp.expect_error(
    $$select public.record_workout_session('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','cccccccc-cccc-4ccc-8ccc-cccccccccccc',0,'[]')$$,
    '42501', null, 'anon cannot execute workout RPC');
reset role;
rollback;

begin isolation level repeatable read;
set local role service_role;
do $$
begin
    begin
        perform public.redeem_reward('11111111-1111-4111-8111-111111111111', '77777777-7777-4777-8777-777777777777');
        raise exception 'FAIL: repeatable read was accepted';
    exception when sqlstate 'P0001' then
        if sqlerrm <> 'unsupported_isolation_level' then raise; end if;
        raise notice 'PASS: stale-snapshot isolation rejected';
    end;
end;
$$;
rollback;

-- Migration 004 additions. Every preceding assertion is preserved verbatim.
begin;
create function pg_temp.assert_true(p_condition boolean, p_label text)
returns void language plpgsql as $$
begin
    if p_condition is distinct from true then raise exception 'FAIL: %', p_label; end if;
    raise notice 'PASS: %', p_label;
end;
$$;
create function pg_temp.expect_error(p_sql text, p_state text, p_message text, p_label text)
returns void language plpgsql as $$
declare v_state text; v_message text;
begin
    begin execute p_sql;
    exception when others then get stacked diagnostics v_state = returned_sqlstate, v_message = message_text;
    end;
    perform pg_temp.assert_true(v_state = p_state and (p_message is null or v_message = p_message), p_label);
end;
$$;
grant execute on function pg_temp.assert_true(boolean, text) to anon, authenticated, service_role;
grant execute on function pg_temp.expect_error(text, text, text, text) to anon, authenticated, service_role;

select pg_temp.assert_true((
    select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'app_private' and c.relname = 'plan_generation_attempts'
), 'internal generation attempts have RLS enabled');
select pg_temp.assert_true(
    not has_schema_privilege('anon', 'app_private', 'USAGE')
    and not has_schema_privilege('authenticated', 'app_private', 'USAGE')
    and not has_table_privilege('anon', 'app_private.plan_generation_attempts', 'SELECT,INSERT,UPDATE,DELETE')
    and not has_table_privilege('authenticated', 'app_private.plan_generation_attempts', 'SELECT,INSERT,UPDATE,DELETE'),
    'internal generation attempts are inaccessible to client roles');
select pg_temp.assert_true(
    not has_function_privilege('anon', 'public.reserve_plan_generation(uuid,timestamptz)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.reserve_plan_generation(uuid,timestamptz)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.save_generated_plan(uuid,uuid,jsonb,jsonb)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.save_generated_plan(uuid,uuid,jsonb,jsonb)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.reserve_plan_generation(uuid,timestamptz)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.save_generated_plan(uuid,uuid,jsonb,jsonb)', 'EXECUTE'),
    'generation reservation and plan persistence execute only for service role');
select pg_temp.assert_true((
    select bool_and(not p.prosecdef and 'search_path=""' = any(p.proconfig))
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('reserve_plan_generation','save_generated_plan')
), 'generation functions are invoker functions with an empty search_path');
select pg_temp.assert_true((
    select is_nullable = 'YES' from information_schema.columns
    where table_schema = 'public' and table_name = 'food_logs' and column_name = 'image_path'
), 'food logs permit a result without retaining an image path');

insert into auth.users(id) values
('e1111111-1111-4111-8111-111111111111'),
('e2222222-2222-4222-8222-222222222222'),
('e3333333-3333-4333-8333-333333333333'),
('e4444444-4444-4444-8444-444444444444');
set local role service_role;
update public.profiles set timezone = 'America/Los_Angeles' where id::text like 'e%';
update public.profiles set is_pro = true where id = 'e1111111-1111-4111-8111-111111111111';
insert into public.subscriptions(user_id, plan, source, status, current_period_end)
values ('e2222222-2222-4222-8222-222222222222', 'pro_monthly', 'verification', 'active', '2027-01-01T00:00:00Z'),
       ('e4444444-4444-4444-8444-444444444444', 'pro_monthly', 'verification', 'active', '2026-11-15T00:00:00Z');

do $$
declare
    v_user uuid := 'e1111111-1111-4111-8111-111111111111';
    v_id uuid;
begin
    v_id := public.reserve_plan_generation(v_user, '2026-03-07T12:00:00Z');
    perform pg_temp.assert_true(v_id is not null, 'the first Free attempt reserves quota');
    perform pg_temp.expect_error(format('select public.reserve_plan_generation(%L,%L)', v_user, '2026-03-14T11:59:59Z'),
        'P0001', 'pro_required', 'Free quota counts unfinished attempts throughout a rolling 168-hour window');
    v_id := public.reserve_plan_generation(v_user, '2026-03-14T12:00:00Z');
    perform pg_temp.assert_true(v_id is not null
        and (select count(*) = 2 from app_private.plan_generation_attempts where user_id = v_user)
        and not exists (select 1 from public.workout_plans where user_id = v_user),
        'Free quota resets at exactly 168 hours despite a DST transition and no stored plans');
    perform pg_temp.expect_error(format('select public.reserve_plan_generation(%L,%L)', v_user, '2026-03-14T12:00:01Z'),
        'P0001', 'pro_required', 'profiles.is_pro cannot bypass the subscription-based quota');
end;
$$;

do $$
declare
    v_user uuid := 'e2222222-2222-4222-8222-222222222222';
    v_id uuid;
    v_i integer;
begin
    for v_i in 1..10 loop
        v_id := public.reserve_plan_generation(v_user, '2026-11-15T07:30:00Z'::timestamptz + (v_i - 1) * interval '1 minute');
        if v_i = 6 then
            perform pg_temp.assert_true(v_id is not null, 'six consecutive Pro attempts are admitted');
        end if;
    end loop;
    perform pg_temp.assert_true((select count(*) = 10 from app_private.plan_generation_attempts where user_id = v_user),
        'ten Pro attempts fit in one user calendar day');
    perform pg_temp.expect_error(format('select public.reserve_plan_generation(%L,%L)', v_user, '2026-11-15T07:59:59Z'),
        'P0001', 'rate_limited', 'the eleventh Pro attempt is rate limited before midnight in the profile timezone');
    v_id := public.reserve_plan_generation(v_user, '2026-11-15T08:00:00Z');
    perform pg_temp.assert_true(v_id is not null, 'Pro quota resets at local midnight instead of UTC midnight');
    v_id := public.reserve_plan_generation('e4444444-4444-4444-8444-444444444444', '2026-11-15T00:00:00Z');
    perform pg_temp.expect_error(
        $query$select public.reserve_plan_generation('e4444444-4444-4444-8444-444444444444','2026-11-15T00:00:01Z')$query$,
        'P0001', 'pro_required', 'a subscription expiring exactly now uses the Free quota');
end;
$$;

do $$
declare
    v_user uuid := 'e2222222-2222-4222-8222-222222222222';
    v_attempts uuid[];
    v_plan1 jsonb := '{"id":"f1111111-1111-4111-8111-111111111111","days":[{"weekday":1}]}';
    v_plan2 jsonb := '{"id":"f2222222-2222-4222-8222-222222222222","days":[{"weekday":3}]}';
    v_result jsonb;
begin
    select array_agg(id order by created_at) into v_attempts from app_private.plan_generation_attempts where user_id = v_user;
    v_result := public.save_generated_plan(v_user, v_attempts[1], v_plan1, '{"age":30,"weekdays":[1]}');
    perform pg_temp.assert_true(v_result = jsonb_build_object('plan', v_plan1)
        and public.coin_balance(v_user) = 20
        and (select input_snapshot = '{"age":30,"weekdays":[1]}'::jsonb from public.workout_plans where id = (v_plan1 ->> 'id')::uuid),
        'first generated plan stores its snapshot and awards exactly twenty coins');
    v_result := public.save_generated_plan(v_user, v_attempts[1], v_plan1, '{"age":30,"weekdays":[1]}');
    perform pg_temp.assert_true(public.coin_balance(v_user) = 20
        and (select count(*) = 1 from public.workout_plans where user_id = v_user),
        'retrying plan persistence for the same attempt is idempotent');
    v_result := public.save_generated_plan(v_user, v_attempts[2], v_plan2, '{"age":30,"weekdays":[3]}');
    perform pg_temp.assert_true(public.coin_balance(v_user) = 20
        and (select count(*) = 1 from public.coin_ledger where user_id = v_user and reason = 'first_plan')
        and (select count(*) = 2 from public.workout_plans where user_id = v_user)
        and (select count(*) = 1 from public.workout_plans where user_id = v_user and active)
        and (select active from public.workout_plans where id = (v_plan2 ->> 'id')::uuid),
        'later generation replaces the active plan without repeating the first-plan award');
    perform pg_temp.expect_error(format(
        'insert into public.workout_plans(user_id,input_snapshot,plan_json) values(%L,%L::jsonb,%L::jsonb)', v_user, '{}', '{}'),
        '23505', null, 'the partial unique index rejects a second active plan');
    perform pg_temp.expect_error(format('select public.save_generated_plan(%L,%L,%L::jsonb,%L::jsonb)',
        'e1111111-1111-4111-8111-111111111111', v_attempts[3], v_plan1, '{}'),
        'P0001', 'validation_error', 'a user cannot save a plan using another user generation attempt');
end;
$$;
insert into public.food_logs(user_id, result_json)
values ('e2222222-2222-4222-8222-222222222222', '{"items":[],"totals":{}}');
select pg_temp.assert_true((select image_path is null from public.food_logs where user_id = 'e2222222-2222-4222-8222-222222222222'),
    'nutrition result can be stored without an image');
reset role;

create function pg_temp.reject_first_plan_credit() returns trigger language plpgsql as $$
begin
    if new.reason = 'first_plan' then
        raise exception using errcode = 'P7779', message = 'Injected first-plan ledger failure.';
    end if;
    return new;
end;
$$;
create trigger verification_reject_first_plan_credit before insert on public.coin_ledger
for each row execute function pg_temp.reject_first_plan_credit();
set local role service_role;
insert into public.workout_plans(id,user_id,input_snapshot,plan_json)
values ('f3333333-3333-4333-8333-333333333333','e3333333-3333-4333-8333-333333333333','{}','{}');
do $$
declare v_attempt uuid;
begin
    v_attempt := public.reserve_plan_generation('e3333333-3333-4333-8333-333333333333','2026-11-15T15:00:00Z');
    perform pg_temp.expect_error(format('select public.save_generated_plan(%L,%L,%L::jsonb,%L::jsonb)',
        'e3333333-3333-4333-8333-333333333333', v_attempt,
        '{"id":"f4444444-4444-4444-8444-444444444444","days":[{"weekday":1}]}', '{}'),
        'P7779', 'Injected first-plan ledger failure.', 'first-plan ledger errors propagate');
    perform pg_temp.assert_true(
        (select active from public.workout_plans where id = 'f3333333-3333-4333-8333-333333333333')
        and not exists (select 1 from public.workout_plans where id = 'f4444444-4444-4444-8444-444444444444')
        and (select plan_id is null from app_private.plan_generation_attempts where id = v_attempt)
        and public.coin_balance('e3333333-3333-4333-8333-333333333333') = 0,
        'failed persistence restores the old active plan and rolls back the new plan, reward and attempt marker');
    perform pg_temp.expect_error(
        $query$select public.reserve_plan_generation('e3333333-3333-4333-8333-333333333333','2026-11-15T15:00:01Z')$query$,
        'P0001', 'pro_required', 'a failed plan save still consumes its previously reserved generation attempt');
end;
$$;
reset role;
drop trigger verification_reject_first_plan_credit on public.coin_ledger;

set local role anon;
select pg_temp.expect_error($query$select public.reserve_plan_generation('e1111111-1111-4111-8111-111111111111')$query$,
    '42501', null, 'anon cannot reserve generation quota');
select pg_temp.expect_error($query$select * from app_private.plan_generation_attempts$query$,
    '42501', null, 'anon cannot read the internal attempt ledger');
reset role;
set local role authenticated;
select pg_temp.expect_error($query$select public.reserve_plan_generation('e1111111-1111-4111-8111-111111111111')$query$,
    '42501', null, 'authenticated cannot reserve generation quota');
select pg_temp.expect_error($query$select public.save_generated_plan('e1111111-1111-4111-8111-111111111111','f1111111-1111-4111-8111-111111111111','{}','{}')$query$,
    '42501', null, 'authenticated cannot persist plans through the server RPC');
reset role;
rollback;
