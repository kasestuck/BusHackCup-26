begin;

create table public.partners (
    id uuid primary key default gen_random_uuid(),
    name text not null check (btrim(name) <> ''),
    type text not null check (type in ('gym', 'supplements')),
    commission_pct numeric(5, 2) not null check (commission_pct between 0 and 100),
    ref_slug text not null unique check (btrim(ref_slug) <> '')
);

create table public.gyms (
    id uuid primary key default gen_random_uuid(),
    name text not null check (btrim(name) <> ''),
    city text not null,
    address text not null,
    qr_secret text not null check (btrim(qr_secret) <> ''),
    partner_id uuid not null references public.partners(id),
    -- Required explicitly: the specification does not choose a default timezone.
    timezone text not null
);

create function public.validate_gym_timezone()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
    if not exists (
        select 1 from pg_catalog.pg_timezone_names where name = new.timezone
    ) then
        raise exception using
            errcode = '23514',
            message = 'Invalid gym timezone.';
    end if;
    return new;
end;
$$;

create trigger gyms_validate_timezone
before insert or update of timezone on public.gyms
for each row execute function public.validate_gym_timezone();

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    display_name text not null default '',
    height_cm numeric check (height_cm > 0),
    weight_kg numeric check (weight_kg > 0),
    goal text check (goal in ('lose_fat', 'build_muscle', 'get_stronger', 'general_fitness', 'endurance')),
    workout_types text[] not null default '{}' check (
        workout_types <@ array['gym_strength', 'home_bodyweight', 'cardio_hiit', 'mobility_yoga']::text[]
        and array_position(workout_types, null) is null
    ),
    session_minutes integer check (session_minutes in (20, 30, 45, 60, 75)),
    weekdays integer[] not null default '{}' check (
        weekdays <@ array[1, 2, 3, 4, 5, 6, 7]
        and array_position(weekdays, null) is null
    ),
    injuries jsonb not null default '[]'::jsonb check (jsonb_typeof(injuries) = 'array'),
    home_gym_id uuid references public.gyms(id),
    is_pro boolean not null default false,
    -- Questionnaire fields missing from the specification's table listing.
    equipment text[] not null default '{}' check (
        equipment <@ array['full_gym', 'dumbbells', 'bands', 'none']::text[]
        and array_position(equipment, null) is null
    ),
    age integer check (age between 18 and 70)
);

create table public.exercises (
    id uuid primary key default gen_random_uuid(),
    slug text not null unique check (btrim(slug) <> ''),
    name text not null check (btrim(name) <> ''),
    muscle_group text not null,
    equipment text not null check (equipment in ('full_gym', 'dumbbells', 'bands', 'none')),
    contraindicated_for text[] not null default '{}' check (
        contraindicated_for <@ array['knee', 'lower back', 'shoulder', 'wrist', 'ankle', 'other']::text[]
        and array_position(contraindicated_for, null) is null
    ),
    video_youtube_id text not null check (btrim(video_youtube_id) <> ''),
    video_title text not null check (btrim(video_title) <> ''),
    verified boolean not null default false
);

create table public.workout_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    created_at timestamptz not null default now(),
    active boolean not null default true,
    input_snapshot jsonb not null check (jsonb_typeof(input_snapshot) = 'object'),
    plan_json jsonb not null check (jsonb_typeof(plan_json) = 'object'),
    unique (id, user_id)
);

create unique index workout_plans_one_active_per_user
on public.workout_plans(user_id) where active;

create table public.workout_sessions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    plan_id uuid not null,
    day_index integer not null check (day_index between 0 and 6),
    completed_at timestamptz not null default now(),
    log_json jsonb not null,
    xp integer not null default 0 check (xp >= 0),
    foreign key (plan_id, user_id) references public.workout_plans(id, user_id)
);

create table public.gym_checkins (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    gym_id uuid not null references public.gyms(id),
    checked_in_at timestamptz not null default now(),
    local_date date not null,
    unique (user_id, local_date)
);

create table public.coin_ledger (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    amount integer not null check (amount <> 0),
    reason text not null check (btrim(reason) <> ''),
    -- Stable event keys: UUIDs, local dates, or week-start dates, as appropriate.
    ref_id text,
    created_at timestamptz not null default now(),
    constraint coin_ledger_reward_reference_required check (
        reason not in ('first_plan', 'workout_session', 'gym_checkin', 'weekly_bonus', 'reward_redemption')
        or (ref_id is not null and btrim(ref_id) <> '')
    ),
    constraint coin_ledger_reward_sign check (
        reason not in ('first_plan', 'workout_session', 'gym_checkin', 'weekly_bonus')
        or amount > 0
    ),
    constraint coin_ledger_redemption_sign check (
        reason <> 'reward_redemption' or amount < 0
    )
);

create unique index coin_ledger_event_once
on public.coin_ledger(user_id, reason, ref_id) where ref_id is not null;

-- A new plan UUID must not permit a second lifetime first-plan bonus.
create unique index coin_ledger_first_plan_once
on public.coin_ledger(user_id, reason) where reason = 'first_plan';

create index coin_ledger_user_id on public.coin_ledger(user_id);

create table public.rewards (
    id uuid primary key default gen_random_uuid(),
    kind text not null check (kind in ('pro_month', 'partner_product')),
    title text not null check (btrim(title) <> ''),
    partner_id uuid references public.partners(id),
    cost_coins integer not null check (cost_coins > 0),
    discount_pct numeric(5, 2) check (discount_pct > 0 and discount_pct <= 100),
    active boolean not null default true,
    constraint rewards_kind_fields check (
        (kind = 'pro_month' and partner_id is null and discount_pct is null)
        or (kind = 'partner_product' and partner_id is not null and discount_pct is not null)
    )
);

create table public.redemptions (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    reward_id uuid not null references public.rewards(id),
    coins_spent integer not null check (coins_spent > 0),
    promo_code text unique check (promo_code is null or btrim(promo_code) <> ''),
    created_at timestamptz not null default now()
);

create table public.subscriptions (
    user_id uuid primary key references public.profiles(id) on delete cascade,
    plan text not null check (btrim(plan) <> ''),
    source text not null check (btrim(source) <> ''),
    status text not null check (btrim(status) <> ''),
    current_period_end timestamptz not null
);

create table public.partner_sales (
    id uuid primary key default gen_random_uuid(),
    partner_id uuid not null references public.partners(id),
    redemption_id uuid not null references public.redemptions(id),
    amount_cents integer not null check (amount_cents >= 0),
    commission_cents integer not null check (commission_cents >= 0 and commission_cents <= amount_cents),
    created_at timestamptz not null default now()
);

create table public.food_logs (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles(id) on delete cascade,
    image_path text not null check (btrim(image_path) <> ''),
    result_json jsonb not null check (jsonb_typeof(result_json) = 'object'),
    created_at timestamptz not null default now()
);

create index workout_sessions_user_id on public.workout_sessions(user_id);
create index workout_plans_user_id on public.workout_plans(user_id);
create index redemptions_user_id on public.redemptions(user_id);
create index food_logs_user_id on public.food_logs(user_id);
create index partner_sales_partner_id on public.partner_sales(partner_id);

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.gyms enable row level security;
alter table public.gym_checkins enable row level security;
alter table public.coin_ledger enable row level security;
alter table public.partners enable row level security;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.partner_sales enable row level security;
alter table public.food_logs enable row level security;

-- Do not rely on project-specific default grants. No client role may write.
revoke all on table
    public.profiles, public.exercises, public.workout_plans, public.workout_sessions,
    public.gyms, public.gym_checkins, public.coin_ledger, public.partners,
    public.rewards, public.redemptions, public.subscriptions, public.partner_sales,
    public.food_logs
from public, anon, authenticated;

grant usage on schema public to authenticated, service_role;
grant select on table
    public.profiles, public.exercises, public.workout_plans, public.workout_sessions,
    public.gym_checkins, public.coin_ledger, public.partners, public.rewards,
    public.redemptions, public.subscriptions, public.food_logs
to authenticated;

-- Row policies cannot hide a secret column: grant only non-secret gym columns.
grant select (id, name, city, address, partner_id, timezone)
on public.gyms to authenticated;

grant select, insert, update, delete on table
    public.profiles, public.exercises, public.workout_plans, public.workout_sessions,
    public.gyms, public.gym_checkins, public.partners, public.rewards,
    public.redemptions, public.subscriptions, public.partner_sales, public.food_logs
to service_role;

-- Correct mistakes with compensating events; the application ledger is append-only.
revoke all on public.coin_ledger from service_role;
grant select, insert on public.coin_ledger to service_role;

create policy profiles_select_own on public.profiles
for select to authenticated using (id = (select auth.uid()));
create policy workout_plans_select_own on public.workout_plans
for select to authenticated using (user_id = (select auth.uid()));
create policy workout_sessions_select_own on public.workout_sessions
for select to authenticated using (user_id = (select auth.uid()));
create policy gym_checkins_select_own on public.gym_checkins
for select to authenticated using (user_id = (select auth.uid()));
create policy coin_ledger_select_own on public.coin_ledger
for select to authenticated using (user_id = (select auth.uid()));
create policy redemptions_select_own on public.redemptions
for select to authenticated using (user_id = (select auth.uid()));
create policy subscriptions_select_own on public.subscriptions
for select to authenticated using (user_id = (select auth.uid()));
create policy food_logs_select_own on public.food_logs
for select to authenticated using (user_id = (select auth.uid()));

create policy exercises_select_catalog on public.exercises
for select to authenticated using (true);
create policy gyms_select_catalog on public.gyms
for select to authenticated using (true);
create policy partners_select_catalog on public.partners
for select to authenticated using (true);
create policy rewards_select_active on public.rewards
for select to authenticated using (active);

-- No partner ownership mapping is specified. Partner sales remain server-only.

create function public.coin_balance(p_user_id uuid)
returns bigint
language sql
stable
security invoker
set search_path = ''
as $$
    select coalesce(sum(amount), 0)::bigint
    from public.coin_ledger
    where user_id = p_user_id;
$$;

create function public.redeem_reward(p_user_id uuid, p_reward_id uuid)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = ''
as $$
declare
    v_reward public.rewards%rowtype;
    v_balance bigint;
    v_redemption_id uuid := gen_random_uuid();
    v_promo_code text;
    v_pro_until timestamptz;
    v_now timestamptz := statement_timestamp();
begin
    -- After a lock wait, the balance query must acquire a fresh snapshot.
    if current_setting('transaction_isolation') <> 'read committed' then
        raise exception using
            errcode = 'P0001',
            message = 'unsupported_isolation_level',
            detail = 'Reward redemption requires READ COMMITTED isolation.';
    end if;

    if p_user_id is null or p_reward_id is null then
        raise exception using
            errcode = 'P0001',
            message = 'invalid_request',
            detail = 'A user ID and reward ID are required.';
    end if;

    -- Every redemption takes this lock before reading the ledger.
    -- Any future debit flow must acquire the same profile lock before its balance check.
    perform 1 from public.profiles where id = p_user_id for update;
    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'profile_not_found',
            detail = 'The user profile does not exist.';
    end if;

    select * into v_reward
    from public.rewards
    where id = p_reward_id and active
    for share;
    if not found then
        raise exception using
            errcode = 'P0001',
            message = 'reward_not_found',
            detail = 'The reward does not exist or is inactive.';
    end if;

    select public.coin_balance(p_user_id) into v_balance;
    if v_balance < v_reward.cost_coins then
        raise exception using
            errcode = 'P0001',
            message = 'not_enough_coins',
            detail = 'You do not have enough coins.';
    end if;

    if v_reward.kind = 'partner_product' then
        v_promo_code := 'SHOWUP-' || upper(replace(gen_random_uuid()::text, '-', ''));
    end if;

    insert into public.redemptions (id, user_id, reward_id, coins_spent, promo_code)
    values (v_redemption_id, p_user_id, p_reward_id, v_reward.cost_coins, v_promo_code);

    insert into public.coin_ledger (user_id, amount, reason, ref_id)
    values (p_user_id, -v_reward.cost_coins, 'reward_redemption', v_redemption_id::text);

    if v_reward.kind = 'pro_month' then
        -- The upsert also handles a subscription inserted by another server flow.
        insert into public.subscriptions as existing (user_id, plan, source, status, current_period_end)
        values (p_user_id, 'pro_monthly', 'coins', 'active', v_now + interval '30 days')
        on conflict (user_id) do update set
            plan = excluded.plan,
            source = excluded.source,
            status = excluded.status,
            current_period_end = greatest(existing.current_period_end, v_now) + interval '30 days'
        returning current_period_end into v_pro_until;

        update public.profiles set is_pro = true where id = p_user_id;

        return jsonb_build_object(
            'balance', v_balance - v_reward.cost_coins,
            'pro_until', v_pro_until
        );
    end if;

    return jsonb_build_object(
        'balance', v_balance - v_reward.cost_coins,
        'promo_code', v_promo_code
    );
end;
$$;

-- PostgreSQL grants EXECUTE to PUBLIC unless it is explicitly revoked.
revoke all on function public.validate_gym_timezone() from public, anon, authenticated;
revoke all on function public.coin_balance(uuid) from public, anon, authenticated;
revoke all on function public.redeem_reward(uuid, uuid) from public, anon, authenticated;
grant execute on function public.validate_gym_timezone() to service_role;
grant execute on function public.coin_balance(uuid) to authenticated, service_role;
grant execute on function public.redeem_reward(uuid, uuid) to service_role;

commit;
