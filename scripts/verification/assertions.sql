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
insert into public.profiles(id) values
('11111111-1111-4111-8111-111111111111'),
('22222222-2222-4222-8222-222222222222');
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
select pg_temp.assert_true((select count(*) = 1 from (select id, name, city, address from public.gyms) safe_gyms),
    'safe gym fields remain readable');
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
