begin;

alter table public.profiles
    add column timezone text not null default 'America/New_York';

create function public.validate_profile_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not exists (
        select 1 from pg_catalog.pg_timezone_names where name = new.timezone
    ) then
        raise exception using errcode = '23514', message = 'Invalid profile timezone.';
    end if;
    return new;
end;
$$;

create trigger profiles_validate_timezone
before insert or update of timezone on public.profiles
for each row execute function public.validate_profile_timezone();

-- A statement trigger runs after existing row triggers, so an existing profile
-- bootstrap can finish first. ON CONFLICT preserves any profile it created.
create function public.create_profiles_for_auth_users()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    insert into public.profiles (id)
    select id from new_auth_users
    on conflict (id) do nothing;
    return null;
end;
$$;

do $$
begin
    if not exists (
        select 1 from pg_catalog.pg_trigger
        where tgrelid = 'auth.users'::regclass
          and tgname = 'showup_create_profiles_after_auth_insert'
          and not tgisinternal
    ) then
        create trigger showup_create_profiles_after_auth_insert
        after insert on auth.users
        referencing new table as new_auth_users
        for each statement execute function public.create_profiles_for_auth_users();
    end if;
end;
$$;

-- Repair users registered before profile bootstrapping was introduced.
insert into public.profiles (id)
select id from auth.users
on conflict (id) do nothing;

-- Human-reviewed video metadata will be supplied later; never invent IDs.
alter table public.exercises
    alter column video_youtube_id drop not null,
    alter column video_title drop not null,
    add constraint exercises_verified_video_required check (
        not verified or (
            video_youtube_id is not null
            and video_youtube_id ~ '^[A-Za-z0-9_-]{11}$'
            and video_title is not null
            and btrim(video_title) <> ''
        )
    );

-- Cover existing public tables and views, not only the original thirteen.
revoke all on all tables in schema public from public, anon, authenticated;
revoke all on all sequences in schema public from public, anon, authenticated;

-- Table-level REVOKE does not remove prior column-level grants (including gyms).
do $$
declare
    v_relation record;
begin
    for v_relation in
        select n.nspname, c.relname,
               string_agg(quote_ident(a.attname), ', ' order by a.attnum) as columns
        from pg_catalog.pg_class c
        join pg_catalog.pg_namespace n on n.oid = c.relnamespace
        join pg_catalog.pg_attribute a on a.attrelid = c.oid
        where n.nspname = 'public'
          and c.relkind in ('r', 'p', 'v', 'm', 'f')
          and a.attnum > 0 and not a.attisdropped
        group by n.nspname, c.relname
    loop
        execute format(
            'revoke all privileges (%s) on table %I.%I from public, anon, authenticated',
            v_relation.columns, v_relation.nspname, v_relation.relname
        );
    end loop;
end;
$$;

-- Only user-owned rows are directly readable. Catalogs go through the server.
grant select on table
    public.profiles, public.workout_plans, public.workout_sessions,
    public.gym_checkins, public.coin_ledger, public.redemptions,
    public.subscriptions, public.food_logs
to authenticated;

-- Remove misleading catalog policies after withdrawing their client grants.
drop policy if exists exercises_select_catalog on public.exercises;
drop policy if exists gyms_select_catalog on public.gyms;
drop policy if exists partners_select_catalog on public.partners;
drop policy if exists rewards_select_active on public.rewards;

-- Harden every application SECURITY DEFINER function in the public schema.
-- Supabase-managed auth/storage/system functions belong to their own schemas.
-- Existing functions may use unqualified public objects. Keep public searchable
-- without allowing clients to create shadow objects there; search temp last.
revoke create on schema public from public, anon, authenticated;
do $$
declare
    v_function record;
    v_grantee record;
begin
    for v_function in
        select p.oid, p.proowner, p.proacl, n.nspname, p.proname,
               pg_get_function_identity_arguments(p.oid) as arguments
        from pg_catalog.pg_proc p
        join pg_catalog.pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
    loop
        if v_function.oid = 'public.create_profiles_for_auth_users()'::regprocedure then
            execute format('alter function %I.%I(%s) set search_path = %L',
                v_function.nspname, v_function.proname, v_function.arguments, '');
        else
            execute format('alter function %I.%I(%s) set search_path = pg_catalog, public, pg_temp',
                v_function.nspname, v_function.proname, v_function.arguments);
        end if;
        execute format('revoke all on function %I.%I(%s) from public, anon, authenticated',
            v_function.nspname, v_function.proname, v_function.arguments);
        for v_grantee in
            select distinct r.rolname
            from pg_catalog.aclexplode(coalesce(v_function.proacl, acldefault('f', v_function.proowner))) acl
            join pg_catalog.pg_roles r on r.oid = acl.grantee
            where acl.privilege_type = 'EXECUTE'
              and acl.grantee <> v_function.proowner
              and r.rolname <> 'service_role'
        loop
            execute format('revoke execute on function %I.%I(%s) from %I',
                v_function.nspname, v_function.proname, v_function.arguments, v_grantee.rolname);
        end loop;
        execute format('grant execute on function %I.%I(%s) to service_role',
            v_function.nspname, v_function.proname, v_function.arguments);
    end loop;
end;
$$;

revoke all on function public.validate_profile_timezone() from public, anon, authenticated;
grant execute on function public.validate_profile_timezone() to service_role;
revoke all on function public.redeem_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.redeem_reward(uuid, uuid) to service_role;

-- Do not inherit broad project defaults for future objects owned by this migrator.
alter default privileges in schema public revoke all on tables from public, anon, authenticated;
alter default privileges in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
