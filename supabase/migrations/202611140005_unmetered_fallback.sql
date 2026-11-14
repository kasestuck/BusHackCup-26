begin;

-- A deterministic plan created without an AI request must not consume quota.
create function public.save_fallback_plan(
    p_user_id uuid,
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
    v_saved_user_id uuid;
    v_saved_plan jsonb;
    v_saved_snapshot jsonb;
begin
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using errcode = 'P0001', message = 'unsupported_isolation_level';
    end if;
    if p_user_id is null
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

    -- Share the per-user lock with metered plans, activity and redemptions.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using errcode = 'P0001', message = 'validation_error';
    end if;
    select user_id, plan_json, input_snapshot
    into v_saved_user_id, v_saved_plan, v_saved_snapshot
    from public.workout_plans where id = v_plan_id;
    if found then
        if v_saved_user_id <> p_user_id
            or v_saved_plan is distinct from p_plan
            or v_saved_snapshot is distinct from p_input_snapshot then
            raise exception using errcode = 'P0001', message = 'validation_error';
        end if;
        -- A replay returns the stored plan without reactivating an old plan.
        return jsonb_build_object('plan', v_saved_plan);
    end if;

    update public.workout_plans set active = false where user_id = p_user_id and active;
    insert into public.workout_plans(id, user_id, active, input_snapshot, plan_json)
    values (v_plan_id, p_user_id, true, p_input_snapshot, p_plan);
    insert into public.coin_ledger(user_id, amount, reason, ref_id)
    values (p_user_id, 20, 'first_plan', v_plan_id::text)
    on conflict (user_id, reason) where reason = 'first_plan' do nothing;
    return jsonb_build_object('plan', p_plan);
end;
$$;

revoke all on function public.save_fallback_plan(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.save_fallback_plan(uuid, jsonb, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
