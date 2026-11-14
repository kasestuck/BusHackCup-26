begin;

-- Demo history uses the same transactional reward rules as live activity.
create or replace function public.seed_demo_account(
    p_user_id uuid,
    p_plan jsonb,
    p_profile jsonb,
    p_gym_id uuid,
    p_events jsonb
)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_plan_id uuid;
    v_event jsonb;
    v_completed_at timestamptz;
    v_day_index integer;
    v_snapshot jsonb;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null or p_gym_id is null
        or jsonb_typeof(p_plan) is distinct from 'object'
        or jsonb_typeof(p_profile) is distinct from 'object'
        or jsonb_typeof(p_events) is distinct from 'array' then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    begin v_plan_id := (p_plan ->> 'id')::uuid;
    exception when invalid_text_representation then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end;
    if v_plan_id is null or jsonb_array_length(p_events) <> 3
        or p_profile ->> 'timezone' is distinct from 'America/Chicago'
        or p_profile -> 'weekdays' is distinct from '[1,3,5]'::jsonb
        or p_profile -> 'session_minutes' is distinct from '45'::jsonb
        or p_profile -> 'equipment' is distinct from '["full_gym"]'::jsonb
        or p_profile -> 'injuries' is distinct from '[]'::jsonb then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if exists (select 1 from public.workout_plans where id = v_plan_id and user_id <> p_user_id) then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    if not exists (select 1 from public.workout_plans where id = v_plan_id and user_id = p_user_id) then
        perform 1 from public.gyms where id = p_gym_id and timezone = 'America/Chicago' for share;
        if not found then
            raise exception using errcode = 'P0001', message = 'gym_not_found';
        end if;
        update public.profiles set
            display_name = p_profile ->> 'display_name',
            height_cm = (p_profile ->> 'height_cm')::numeric,
            weight_kg = (p_profile ->> 'weight_kg')::numeric,
            age = (p_profile ->> 'age')::integer,
            goal = p_profile ->> 'goal',
            workout_types = array(select jsonb_array_elements_text(p_profile -> 'workout_types')),
            equipment = array['full_gym']::text[],
            session_minutes = 45,
            weekdays = array[1,3,5],
            injuries = '[]'::jsonb,
            timezone = 'America/Chicago',
            home_gym_id = p_gym_id
        where id = p_user_id;
        v_snapshot := p_profile - 'timezone' - 'display_name';
        perform public.save_fallback_plan(p_user_id, p_plan, v_snapshot);
        for v_event in select value from jsonb_array_elements(p_events) loop
            v_completed_at := (v_event ->> 'completed_at')::timestamptz;
            v_day_index := (v_event ->> 'day_index')::integer;
            if v_completed_at is null or not isfinite(v_completed_at)
                or (v_completed_at at time zone 'America/Chicago')::date >= (statement_timestamp() at time zone 'America/Chicago')::date
                or v_day_index is null
                or extract(isodow from v_completed_at at time zone 'America/Chicago')::integer
                    is distinct from (p_plan -> 'days' -> v_day_index ->> 'weekday')::integer then
                raise exception using errcode = 'P0001', message = 'validation_error';
            end if;
            -- Existing historical activity is preserved. The profile lock prevents races.
            if not exists (select 1 from public.gym_checkins where user_id = p_user_id
                and local_date = (v_completed_at at time zone 'America/Chicago')::date) then
                perform public.record_gym_checkin(p_user_id, p_gym_id, v_completed_at);
            end if;
            if not exists (select 1 from public.workout_sessions where user_id = p_user_id
                and local_date = (v_completed_at at time zone 'America/Chicago')::date) then
                perform public.record_workout_session(p_user_id, v_plan_id, v_day_index, v_event -> 'exercises', v_completed_at);
            end if;
        end loop;
    end if;
    return jsonb_build_object(
        'plans', (select count(*) from public.workout_plans where user_id = p_user_id),
        'checkins', (select count(*) from public.gym_checkins where user_id = p_user_id),
        'sessions', (select count(*) from public.workout_sessions where user_id = p_user_id),
        'ledger_entries', (select count(*) from public.coin_ledger where user_id = p_user_id)
    );
end;
$$;

revoke all on function public.seed_demo_account(uuid, jsonb, jsonb, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.seed_demo_account(uuid, jsonb, jsonb, uuid, jsonb) to service_role;

commit;
NOTIFY pgrst, 'reload schema';
