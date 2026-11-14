begin;

-- Attempts are an internal cost/quota ledger, not a client-facing resource.
create schema app_private;
revoke all on schema app_private from public, anon, authenticated;
grant usage on schema app_private to service_role;

create table app_private.plan_generation_attempts (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default statement_timestamp(),
    -- Keep consumed attempts even if a stored plan is subsequently deleted.
    plan_id uuid
);
alter table app_private.plan_generation_attempts enable row level security;
revoke all on app_private.plan_generation_attempts from public, anon, authenticated, service_role;
grant select, insert, update on app_private.plan_generation_attempts to service_role;
create index plan_generation_attempts_user_time
on app_private.plan_generation_attempts(user_id, created_at);

alter table public.food_logs alter column image_path drop not null;

create function public.reserve_plan_generation(
    p_user_id uuid,
    p_now timestamptz default null
)
returns uuid
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_timezone text;
    v_is_pro boolean;
    v_start timestamptz;
    v_end timestamptz;
    v_local_date date;
    v_count integer;
    v_attempt_id uuid;
    v_now timestamptz;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null or (p_now is not null and not isfinite(p_now)) then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;

    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('plan-generation:' || p_user_id::text, 0));
    -- Read the production clock after the lock wait, not at statement start.
    -- Explicit timestamps are reserved for trusted service-role test fixtures.
    v_now := coalesce(p_now, clock_timestamp());
    select timezone into v_timezone from public.profiles where id = p_user_id for share;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    select exists (
        select 1 from public.subscriptions where user_id = p_user_id and current_period_end > v_now
    ) into v_is_pro;

    if v_is_pro then
        v_local_date := (v_now at time zone v_timezone)::date;
        v_start := v_local_date::timestamp at time zone v_timezone;
        v_end := (v_local_date + 1)::timestamp at time zone v_timezone;
        select count(*) into v_count from app_private.plan_generation_attempts
        where user_id = p_user_id and created_at >= v_start and created_at < v_end;
        if v_count >= 10 then
            raise exception using errcode = 'P0001', message = 'rate_limited';
        end if;
    else
        -- A rolling seven-day interval is exactly 168 hours, including DST weeks.
        v_start := v_now - interval '168 hours';
        select count(*) into v_count from app_private.plan_generation_attempts
        where user_id = p_user_id and created_at > v_start;
        if v_count >= 1 then
            raise exception using errcode = 'P0001', message = 'pro_required';
        end if;
    end if;

    insert into app_private.plan_generation_attempts(user_id, created_at)
    values (p_user_id, v_now) returning id into v_attempt_id;
    return v_attempt_id;
end;
$$;

create function public.save_generated_plan(
    p_user_id uuid,
    p_attempt_id uuid,
    p_plan jsonb,
    p_input_snapshot jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
    v_saved_id uuid;
    v_saved_plan jsonb;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null or p_attempt_id is null
        or jsonb_typeof(p_plan) is distinct from 'object'
        or jsonb_typeof(p_input_snapshot) is distinct from 'object' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    begin
        v_plan_id := (p_plan ->> 'id')::uuid;
    exception when invalid_text_representation then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end;
    if v_plan_id is null or jsonb_typeof(p_plan -> 'days') is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if jsonb_array_length(p_plan -> 'days') not between 1 and 7 then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;

    -- Share the per-user balance lock with activity and redemption functions.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    select plan_id into v_saved_id from app_private.plan_generation_attempts
    where id = p_attempt_id and user_id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if v_saved_id is not null then
        select plan_json into v_saved_plan from public.workout_plans
        where id = v_saved_id and user_id = p_user_id;
        if not found then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        return jsonb_build_object('plan', v_saved_plan);
    end if;

    update public.workout_plans set active = false where user_id = p_user_id and active;
    insert into public.workout_plans(id, user_id, active, input_snapshot, plan_json)
    values (v_plan_id, p_user_id, true, p_input_snapshot, p_plan);
    insert into public.coin_ledger(user_id, amount, reason, ref_id)
    values (p_user_id, 20, 'first_plan', v_plan_id::text)
    on conflict (user_id, reason) where reason = 'first_plan' do nothing;
    update app_private.plan_generation_attempts set plan_id = v_plan_id where id = p_attempt_id;
    return jsonb_build_object('plan', p_plan);
end;
$$;

revoke all on function public.reserve_plan_generation(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.save_generated_plan(uuid, uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.reserve_plan_generation(uuid, timestamptz) to service_role;
grant execute on function public.save_generated_plan(uuid, uuid, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
