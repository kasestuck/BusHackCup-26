begin;

-- Preserve the calendar date used for workout rewards even after a profile
-- timezone changes. Historical rows use the profile timezone at migration time.
alter table public.workout_sessions add column local_date date;
update public.workout_sessions s
set local_date = (s.completed_at at time zone p.timezone)::date
from public.profiles p where p.id = s.user_id;
alter table public.workout_sessions alter column local_date set not null;

create function public.set_workout_session_local_date()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare v_timezone text;
begin
    select timezone into v_timezone from public.profiles where id = new.user_id;
    if not found or new.completed_at is null or not isfinite(new.completed_at) then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    new.local_date := (new.completed_at at time zone v_timezone)::date;
    return new;
end;
$$;

create trigger workout_sessions_set_local_date
before insert or update of user_id, completed_at, local_date on public.workout_sessions
for each row execute function public.set_workout_session_local_date();

create index workout_sessions_user_local_date
on public.workout_sessions(user_id, local_date);

-- The generic event index also protects these keys. These narrower indexes
-- explicitly document the day/week idempotency rules used by the RPCs.
create unique index coin_ledger_workout_day_once
on public.coin_ledger(user_id, ref_id) where reason = 'workout_session';
create unique index coin_ledger_weekly_bonus_once
on public.coin_ledger(user_id, ref_id) where reason = 'weekly_bonus';

create function public.record_gym_checkin(
    p_user_id uuid,
    p_gym_id uuid,
    p_checked_in_at timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_timezone text;
    v_local_date date;
    v_checkin_id uuid;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null or p_gym_id is null or p_checked_in_at is null
        or not isfinite(p_checked_in_at) then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;

    -- Match the lock used by redemption and workout recording. Every balance
    -- returned below includes earlier committed activity for this user.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    select timezone into v_timezone from public.gyms where id = p_gym_id for share;
    if not found then
        raise exception using errcode = 'P0001', message = 'gym_not_found';
    end if;
    v_local_date := (p_checked_in_at at time zone v_timezone)::date;

    -- Attempt the insert itself: no read-before-write race can award twice.
    insert into public.gym_checkins(user_id, gym_id, checked_in_at, local_date)
    values (p_user_id, p_gym_id, p_checked_in_at, v_local_date)
    on conflict (user_id, local_date) do nothing
    returning id into v_checkin_id;
    if not found then
        raise exception using errcode = 'P0001', message = 'already_checked_in';
    end if;

    insert into public.coin_ledger(user_id, amount, reason, ref_id, created_at)
    values (p_user_id, 40, 'gym_checkin', v_checkin_id::text, p_checked_in_at);
    return jsonb_build_object('coins_earned', 40, 'balance', public.coin_balance(p_user_id));
end;
$$;

create function public.record_workout_session(
    p_user_id uuid,
    p_plan_id uuid,
    p_day_index integer,
    p_exercises jsonb,
    p_completed_at timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_timezone text;
    v_weekdays integer[];
    v_local_date date;
    v_week_start date;
    v_plan jsonb;
    v_day jsonb;
    v_exercise jsonb;
    v_set jsonb;
    v_slug text;
    v_seen_slugs text[] := '{}';
    v_sets integer := 0;
    v_exercise_sets integer;
    v_reps numeric;
    v_weight numeric;
    v_inserted integer;
    v_coins integer := 0;
    v_xp integer;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null or p_plan_id is null or p_day_index is null
        or p_day_index < 0 or p_day_index > 6 or p_completed_at is null
        or not isfinite(p_completed_at) then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if jsonb_typeof(p_exercises) is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if jsonb_array_length(p_exercises) not between 1 and 20 then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;

    select timezone, weekdays into v_timezone, v_weekdays
    from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    select plan_json into v_plan from public.workout_plans
    where id = p_plan_id and user_id = p_user_id for share;
    if not found or jsonb_typeof(v_plan -> 'days') is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if p_day_index >= jsonb_array_length(v_plan -> 'days') then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    v_day := v_plan -> 'days' -> p_day_index;
    if jsonb_typeof(v_day -> 'exercises') is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;

    -- These bounds mirror economy.ts. RPC-level validation prevents a future
    -- server caller from bypassing the API's ownership and workload checks.
    for v_exercise in select value from jsonb_array_elements(p_exercises) loop
        if jsonb_typeof(v_exercise) is distinct from 'object' then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        if jsonb_typeof(v_exercise -> 'slug') is distinct from 'string'
            or jsonb_typeof(v_exercise -> 'sets') is distinct from 'array'
            or exists (select 1 from jsonb_object_keys(v_exercise) as field(name)
                       where name not in ('slug', 'sets')) then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        v_slug := v_exercise ->> 'slug';
        if btrim(v_slug) = '' or v_slug = any(v_seen_slugs)
            or not exists (
                select 1 from jsonb_array_elements(v_day -> 'exercises') as planned(value)
                where value ->> 'slug' = v_slug
            ) then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        v_seen_slugs := array_append(v_seen_slugs, v_slug);
        v_exercise_sets := jsonb_array_length(v_exercise -> 'sets');
        if v_exercise_sets not between 1 and 10 then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        v_sets := v_sets + v_exercise_sets;
        if v_sets > 60 then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        for v_set in select value from jsonb_array_elements(v_exercise -> 'sets') loop
            if jsonb_typeof(v_set) is distinct from 'object' then
                raise exception using errcode = 'P0001', message = 'validation_error';
            end if;
            if jsonb_typeof(v_set -> 'reps') is distinct from 'number'
                or jsonb_typeof(v_set -> 'weight_kg') is distinct from 'number'
                or exists (select 1 from jsonb_object_keys(v_set) as field(name)
                           where name not in ('reps', 'weight_kg')) then
                raise exception using errcode = 'P0001', message = 'validation_error';
            end if;
            v_reps := (v_set ->> 'reps')::numeric;
            v_weight := (v_set ->> 'weight_kg')::numeric;
            if v_reps <> trunc(v_reps) or v_reps not between 1 and 100
                or v_weight not between 0 and 500 then
                raise exception using errcode = 'P0001', message = 'validation_error';
            end if;
        end loop;
    end loop;

    v_local_date := (p_completed_at at time zone v_timezone)::date;
    v_week_start := v_local_date - (extract(isodow from v_local_date)::integer - 1);
    v_xp := least(100, 5 * v_sets);
    insert into public.workout_sessions(user_id, plan_id, day_index, completed_at, log_json, xp, local_date)
    values (p_user_id, p_plan_id, p_day_index, p_completed_at, p_exercises, v_xp, v_local_date);

    insert into public.coin_ledger(user_id, amount, reason, ref_id, created_at)
    values (p_user_id, 10, 'workout_session', to_char(v_local_date, 'YYYY-MM-DD'), p_completed_at)
    on conflict (user_id, ref_id) where reason = 'workout_session' do nothing;
    get diagnostics v_inserted = row_count;
    v_coins := v_inserted * 10;

    if cardinality(v_weekdays) > 0 and not exists (
        select 1 from unnest(v_weekdays) as scheduled(weekday)
        where not exists (
            select 1 from public.workout_sessions s
            where s.user_id = p_user_id
              and s.local_date = v_week_start + (scheduled.weekday - 1)
        )
    ) then
        insert into public.coin_ledger(user_id, amount, reason, ref_id, created_at)
        values (p_user_id, 50, 'weekly_bonus', to_char(v_week_start, 'YYYY-MM-DD'), p_completed_at)
        on conflict (user_id, ref_id) where reason = 'weekly_bonus' do nothing;
        get diagnostics v_inserted = row_count;
        v_coins := v_coins + v_inserted * 50;
    end if;
    return jsonb_build_object(
        'xp_earned', v_xp, 'coins_earned', v_coins, 'balance', public.coin_balance(p_user_id)
    );
end;
$$;

revoke all on function public.set_workout_session_local_date() from public, anon, authenticated;
revoke all on function public.record_gym_checkin(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.record_workout_session(uuid, uuid, integer, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.set_workout_session_local_date() to service_role;
grant execute on function public.record_gym_checkin(uuid, uuid, timestamptz) to service_role;
grant execute on function public.record_workout_session(uuid, uuid, integer, jsonb, timestamptz) to service_role;

notify pgrst, 'reload schema';
commit;
