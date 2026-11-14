# Проверка контракта и миграции

Это отдельный проверочный пакет, не зависимости будущего приложения. Node 22+ и pnpm. Исходные данные тестов временные: это не seed и не данные демо-приложения. API-маршрутов здесь нет. `docs/SPEC.md` отсутствовал; по подтверждению пользователя использован приложенный PDF целиком.

## Команды

Из корня репозитория:

```powershell
pnpm --dir scripts/verification install --frozen-lockfile --ignore-scripts
node scripts/verification/verify.mjs
```

Первый тест использует PGlite в памяти: создаёт минимальные Supabase Auth primitives (`auth.users`, `auth.uid`, роли), намеренно выдаёт широкие default grants, затем применяет миграцию и проверяет, что она закрывает эти grants. В `assertions.sql` все данные создаются между BEGIN/ROLLBACK. Проверяются SQL, реальные роли и RLS, идемпотентность наград, атомарный откат ошибки после вставки списания, обе разновидности redeem и продление Pro. Затем все TypeScript-блоки документа компилируются вместе и проверяются примеры всех 13 запросов, успешных ответов и ошибок. Примеры JSON и image File — только входы тестов; AI и HTTP не вызываются.

Для реального параллелизма на Windows x64:

```powershell
node scripts/verification/native-runner.mjs
```

Runner создаёт отдельный локальный PostgreSQL из optional dependency, слушающий только `127.0.0.1` на свободном порту, запускает полный набор проверок и `concurrency.mjs`, затем останавливает сервер. Он не использует существующий Supabase-проект. Каталог кластера и журнал сохраняются в игнорируемой `.cache/`; это позволяет разобрать сбой. PGlite использует одно соединение и сам по себе не проверяет конкуренцию ([документация PGlite](https://pglite.dev/docs/)).

`concurrency.mjs` проверяет разные backend PID, реальное ожидание блокировки вторым соединением через `pg_blocking_pids`, затем COMMIT первого и отказ второго `not_enough_coins`. Проверяются один debit, один redemption, одна подписка, баланс 0. Его также можно запускать отдельно на **пустой тестовой** PostgreSQL/Supabase БД с уже применённой миграцией:

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
psql "$env:TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f scripts/verification/assertions.sql
```

Первая команда применяется только один раз к новой базе; миграция намеренно не содержит `IF NOT EXISTS`, скрывающего расхождение схемы. `assertions.sql` завершается ROLLBACK и не оставляет тестовых данных. Локальный bootstrap в `verify.mjs` предназначен исключительно для нового кластера и **не запускается** на готовом Supabase.

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

select has_function_privilege('anon', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as anon_redeem,
       has_function_privilege('authenticated', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as user_redeem,
       has_function_privilege('service_role', 'public.redeem_reward(uuid,uuid)', 'EXECUTE') as server_redeem;
-- Expected: false, false, true.
```

Точные негативные INSERT/UPDATE/RPC и SELECT чужих строк находятся в `assertions.sql`, а не только в проверках наличия RLS-флага. В SQL функция возвращает чужому пользователю 0 через RLS, а сервису — фактическую сумму.

## Границы результата

Применение миграции, SQL-ограничения, RLS, транзакция redeem и схемы контрактов проверяются локально. Реальный Supabase Auth, PostgREST, Storage, Next.js, cookie-сессии, HTTP-коды на сервере, AI и billing ещё не реализованы/не проверены. HTTP curl к отсутствующим маршрутам не подтверждает эти результаты, поэтому команды curl не приводятся.

Правила grants/RLS и EXECUTE сверены с [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) и [Supabase functions](https://supabase.com/docs/guides/database/functions). Перечень расхождений PDF, предложенных решений контракта и решений миграции находится в `docs/contract-proposal.md`.
