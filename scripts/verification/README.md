# Проверка контракта и миграций

Это отдельный проверочный пакет, не зависимости приложения. Node 22.18+ и pnpm. Исходные данные тестов временные: это не seed и не данные демо-приложения. `docs/SPEC.md` отсутствовал; по подтверждению пользователя использован приложенный PDF целиком. Для новых RPC расширены существующие assertions и concurrency; новых проверочных пакетов или runner-файлов не добавлено.

## Команды

Из корня репозитория:

```powershell
pnpm --dir scripts/verification install --frozen-lockfile --ignore-scripts
node scripts/verification/verify.mjs
```

Без `TEST_DATABASE_URL` первый тест использует PGlite в памяти: создаёт минимальные Supabase Auth primitives (`auth.users`, `auth.uid`, роли), намеренно выдаёт широкие default grants, затем применяет **все** SQL-миграции по имени и проверяет закрытие grants. В `assertions.sql` все данные создаются между BEGIN/ROLLBACK. Проверяются SQL, реальные роли и RLS, регистрация профиля, идемпотентность наград, атомарный откат ошибки после вставки списания, обе разновидности redeem и продление Pro. Затем все TypeScript-блоки документа компилируются вместе и проверяются примеры всех 13 запросов, успешных ответов и ошибок, включая 500 и новые ошибки QR. Примеры JSON и image File — только входы тестов; AI и HTTP не вызываются.

Для activity RPC проверяются календарная полночь в timezone зала, +40 за check-in, отсутствие награды при повторе, +10 за первую тренировку в дне профиля, сохранение повторных тренировок с нулевой наградой, XP и пределы нагрузки, принадлежность плана, бонус +50 за все запланированные дни текущей ISO-недели и отсутствие повторного бонуса. Инъекции ошибки в ledger доказывают откат check-in, session и всей цепочки session → daily reward → weekly bonus.

Для реального параллелизма на Windows x64:

```powershell
node scripts/verification/native-runner.mjs
```

Runner создаёт отдельный локальный PostgreSQL из optional dependency, слушающий только `127.0.0.1` на свободном порту, запускает полный набор проверок и `concurrency.mjs`, затем останавливает сервер. Он не использует существующий Supabase-проект. Каталог кластера и журнал сохраняются в игнорируемой `.cache/`; это позволяет разобрать сбой. PGlite использует одно соединение и сам по себе не проверяет конкуренцию ([документация PGlite](https://pglite.dev/docs/)).

`concurrency.mjs` проверяет разные backend PID и реальное ожидание блокировки вторым соединением через `pg_blocking_pids`. Для redeem после COMMIT первого второй получает `not_enough_coins`; остаются один debit, один redemption и одна подписка. Два check-in дают одну строку, одну награду +40 и один `already_checked_in`; HTTP 409 проверяется отдельно в тестах обработчика. Две тренировки сохраняются обе, но награда +10 выдаётся одна. Его также можно запускать отдельно на **пустой тестовой** PostgreSQL/Supabase БД с уже применёнными миграциями:

```powershell
$env:TEST_DATABASE_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$env:TEST_DATABASE_DISPOSABLE = '1'
node scripts/verification/concurrency.mjs
Remove-Item Env:TEST_DATABASE_URL
Remove-Item Env:TEST_DATABASE_DISPOSABLE
```

Не передавайте production connection string. Runner конкуренции коммитит случайные fixtures, необходимые двум соединениям, и удаляет только их в `finally`; при аварийном завершении они могут остаться. Он отказывается работать, если в profiles уже есть строки.

## Повтор SQL-проверок на тестовом Supabase

`assertions.sql` рассчитан на уже применённую миграцию и подключение администратора. Он использует реальные Supabase роли и `auth.uid()` при наличии Supabase, не заменяя их. Требуется пустая тестовая public-схема с ровно этими 13 таблицами.

```powershell
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140001_initial_schema.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140002_profile_bootstrap_and_permissions.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140003_activity_rewards.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140004_ai_generation.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140005_unmetered_fallback.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140006_commerce.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/202611140007_demo_seed.sql
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verification/assertions.sql
```

Каждая миграция применяется только один раз и строго по порядку; уже применённые миграции не переписывались. `assertions.sql` завершается ROLLBACK и не оставляет тестовых данных. Локальный bootstrap в `verify.mjs` предназначен исключительно для нового кластера и **не запускается** на готовом Supabase.

Для самостоятельной инспекции без изменения данных:

```sql
select tablename, rowsecurity from pg_tables
where schemaname = 'public' order by tablename;

select tablename, policyname, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public' order by tablename;

select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
order by table_name, grantee, privilege_type;

select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and ((table_name = 'profiles' and column_name in ('age', 'equipment'))
    or (table_name = 'gyms' and column_name = 'timezone'));

select indexname, indexdef from pg_indexes
where schemaname = 'public' and tablename in ('gym_checkins', 'coin_ledger');

select pg_get_functiondef('public.coin_balance(uuid)'::regprocedure);
select pg_get_functiondef('public.redeem_reward(uuid,uuid)'::regprocedure);
select pg_get_functiondef('public.record_gym_checkin(uuid,uuid,timestamptz)'::regprocedure);
select pg_get_functiondef('public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)'::regprocedure);

select has_function_privilege('anon', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as anon_redeem,
       has_function_privilege('authenticated', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as user_redeem,
       has_function_privilege('service_role', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as server_redeem;
-- Expected: false, false, true.
```

Точные негативные INSERT/UPDATE/RPC и SELECT чужих строк находятся в `assertions.sql`, а не только в проверках наличия RLS-флага. В SQL функция возвращает чужому пользователю 0 через RLS, а сервису — фактическую сумму.

## Границы результата

Применение миграций, SQL-ограничения, RLS, транзакции redeem/check-in/session и схемы контрактов проверяются локально. Последний native-runner прошёл с кодом 0; изолированный PostgreSQL остановлен, fixtures удалены либо откатились. Первоначальный sandbox-запуск не смог соединиться с loopback (`EACCES`); повторный запуск с доступом к локальному сокету прошёл после адаптации прав временных helper-функций к миграции 002.

Реальный Supabase Auth, PostgREST, Storage и HTTP-маршруты этот runner не вызывает. Примитив `auth.uid()` и роли воспроизводятся локально; это не настоящий JWT/Supabase Auth. Проверки приложения и точные curl приведены в `docs/backend-integration.md`. Проверка HMAC-окон и прикладной валидации выполняется через `node --test` в корне.

Правила grants/RLS и EXECUTE сверены с [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) и [Supabase functions](https://supabase.com/docs/guides/database/functions). Перечень расхождений PDF, предложенных решений контракта и решений миграции находится в `docs/contract-proposal.md`.

## Квоты AI и сохранение планов: миграция 004

В конец `assertions.sql` добавлен независимый блок, исходные 28299 байт файла сохранены без изменений. SHA-256 этого префикса: `872a1a80417936e2965603d087e3e395df5b88a60b17ace16fb58b8e950ac2cc`. Проверки прежних 13 public-таблиц по-прежнему выполняются: внутренняя таблица попыток находится в `app_private`, отдельно проверяется её RLS и отсутствие доступа клиентских ролей.

Новые SQL-кейсы проверяют скользящие 168 часов Free, квоту Pro по локальной полуночи, шестую/десятую/одиннадцатую попытки, использование реальной подписки вместо `profiles.is_pro`, сохранение снимка анкеты, единственную награду +20, повторную запись того же attempt, единственный active plan, запрет чужого attempt и полный откат при ошибке ledger. Попытка резервируется до AI и не отменяется при ошибке последующей записи плана. `food_logs.image_path` nullable: тест сохраняет только результат без изображения.

`concurrency.mjs` дополнен конкурентным резервированием Free-квоты через реальные соединения и advisory lock: ровно один attempt, второй вызов получает `pro_required`. Производственный timestamp берётся после ожидания advisory lock; необязательный p_now предназначен только для доверенных service-role fixtures. Эти SQL-проверки не вызывают AI и не доказывают работу HTTP-провайдера.

Миграция 005 добавляет серверное сохранение запасного плана без попытки, когда AI не настроен. В конец assertions.sql добавлены 142 строки; прежнее содержимое сохранено. Проверяются отсутствие попытки, единственная награда +20, одна активная версия, идемпотентный повтор, запрет чужого ID, откат при ошибке ledger и запрет RPC для anon/authenticated. Существующий save_generated_plan по-прежнему требует зарезервированную попытку. Проверки пустого каталога, ввода и общего AI-бюджета находятся в существующем lib/server/plans.test.ts; новых runner-файлов нет.
