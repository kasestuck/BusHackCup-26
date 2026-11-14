# Передача backend после contract-v1

Ветка `BACK`. Временный каркас находится в отдельном коммите `fbc5138` (`chore: throwaway scaffold (do not merge)`). При переносе в Next.js-проект фронтенда его можно пропустить. Локальный тег `contract-v1` остаётся на `c6136e2`; он не перемещался. Актуальный контракт расширен поверх этой версии.

`docs/SPEC.md` отсутствует в checkout. Источник — ранее разрешённый PDF и `docs/contract-proposal.md`, с приоритетом текущих заданий пользователя. `lib/contract-draft/index.ts` дословно объединяет 17 TypeScript-блоков предложения; сервер импортирует их только через `lib/server/contract.ts`. `lib/contract/**` не изменён.

## Изменения контракта

- Добавлены `GymNotFoundErrorSchema`, `GymNotFoundResponseSchema`, их выведенные типы и сообщение `The gym was not found.`: HTTP 404 `gym_not_found` в общих ошибках и QR-маршруте.
- В ошибки QR-маршрута добавлен существующий HTTP 429 `rate_limited`.
- По прямому указанию пользователя QR-маршрут не требует сессии, но требует `x-gym-key`; Bearer JWT добавлен как запасной способ авторизации остальных маршрутов.
- Неизвестный зал и неверный/просроченный токен check-in сохраняют существующий HTTP 422 `validation_error`. Нового кода для токена нет.
- Схемы запросов и успешных ответов не изменены. Новые границы нагрузок проверяются как бизнес-правила по явному заданию пользователя, без изменения типов Zod-контракта.
- Ранее согласованный HTTP 500 `internal_error` с точным сообщением `An unexpected error occurred.` остаётся во всех 13 схемах ошибок. Поля nutrition `confidence` и `disclaimer` сохранены.

## Зависимости и окружение

Проверенный runtime: Node.js 24.22.1; требуется Node.js 22.18+ для нативного исполнения `.ts` в тестах/seed. Менеджер пакетов — pnpm 11.25.0. Новых зависимостей на этом этапе нет. Все прямые зависимости временного каркаса с установленными версиями:

| Назначение | Пакет | Версия |
|---|---|---|
| Сервер, cookie Auth | @supabase/ssr | 0.12.7 |
| Сервер, Auth/REST/RPC | @supabase/supabase-js | 2.119.0 |
| Framework | next | 16.4.6 |
| Framework | react | 19.3.1 |
| Framework | react-dom | 19.3.1 |
| Защита серверных модулей | server-only | 0.0.1 |
| Контракт | zod | 4.6.7 |
| Компиляция | typescript | 5.9.3 |
| Типы | @types/node | 24.19.2 |
| Типы | @types/react | 19.3.0 |
| Типы | @types/react-dom | 19.3.0 |
| Только каркас | tailwindcss | 4.3.5 |
| Только каркас | @tailwindcss/postcss | 4.3.5 |
| Только каркас | postcss | 8.5.32 |

Существующий отдельный пакет `scripts/verification`: `@electric-sql/pglite` 0.5.16, `pg` 8.23.1, `typescript` 5.9.3, `zod` 4.6.7; optional `@embedded-postgres/windows-x64` 18.6.0-beta.19. Он не является workspace приложения; его node_modules игнорируется Git и исключён из корневого tsconfig. Node-тесты используют встроенный `node:test`, HTTP-тесты запускают тот же Node с условием `react-server`, без дополнительных пакетов.

Полный список переменных, читаемых production backend:

| Переменная | Назначение |
|---|---|
| SUPABASE_URL | URL проекта; основной вариант |
| NEXT_PUBLIC_SUPABASE_URL | Запасной URL, если основной отсутствует/пуст |
| SUPABASE_ANON_KEY | Anon/publishable key для cookie и Bearer-клиентов |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Запасной anon key |
| SUPABASE_SERVICE_ROLE_KEY | Только сервер: admin-клиент, каталоги и RPC записи |
| GYM_ADMIN_KEY | Только сервер: общий ключ публичного QR-экрана |

Для работы нужны URL, anon key, service role и GYM_ADMIN_KEY. Значения секретов не должны попадать в Git, ответы или логи. У service role и gym key нет вариантов NEXT_PUBLIC. `TEST_DATABASE_URL` и `TEST_DATABASE_DISPOSABLE=1` нужны только существующему SQL runner; native-runner сам задаёт их для изолированной локальной БД. Seed и live PostgREST smoke используют серверные SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY по своей документации; видео-валидатор ключей не требует.

Для переноса `.ts` импортов нужны `allowImportingTsExtensions: true`, `noEmit: true`, DOM-типы для контрактного `File`, Next.js App Router. Применяются все три миграции в порядке имени; старые две не переписаны.

## Авторизация и ошибки

Cookie остаётся основной: стандартная Supabase SSR-сессия `sb-…-auth-token`, проверенная `auth.getUser()`. При отсутствии или неуспешной проверке cookie сервер пробует `Authorization: Bearer <JWT>` через `auth.getUser(token)`. Последующие REST-запросы выполняет клиент с тем же JWT и anon key. Валидная cookie имеет приоритет, если одновременно передан Bearer другой учётной записи.

Неуспешная проверка credentials, включая истечение, чужой проект и ошибки декодирования, возвращает 401. В границе авторизации 500 возникает только при отсутствующей/невалидной серверной конфигурации: серверный лог содержит `SERVER CONFIGURATION ERROR` и имена переменных без значений. Ошибки самого обработчика/БД после авторизации по-прежнему возвращают безопасный 500; считать их неверной сессией нельзя. Ответы имеют no-store и `Vary: Cookie, Authorization`.

## Маршруты и транзакции

- `GET /api/me`: профиль, баланс через `coin_balance`, streak, Pro по сроку подписки и наличие активного плана. `profile.is_pro` в ответе согласован с верхним `is_pro`.
- `POST /api/onboarding`: строгая анкета, метрика, проверенный user ID, сохранение timezone. При её отсутствии сохраняется текущее значение; новый профиль получает America/New_York из миграции.
- `GET /api/gyms`: только id/name/city/address. `GET /api/rewards`: только активные награды.
- `GET /api/gyms/:id/qr-token`: без Supabase-сессии. x-gym-key сравнивается через timingSafeEqual над SHA-256 фиксированной длины. Ошибочный/отсутствующий ключ — 401 invalid_gym_key, неверный UUID — 422, неизвестный UUID — 404. Токен — HMAC-SHA256(qr_secret, String(floor(unix_seconds/60))) в lowercase hex, expires_in 1..60 до конца текущего окна.
- `POST /api/checkin`: принимает текущее и предыдущее HMAC-окно. Неверный/старый токен — 422 до RPC. Проверенный серверный timestamp общий для проверки токена и SQL-даты. `record_gym_checkin` сам вычисляет дату в timezone зала, вставляет check-in и +40 в одной транзакции. Конфликт unique(user_id, local_date) даёт already_checked_in, преобразуемый в HTTP 409; второй награды нет. Ответ: coins_earned, streak, balance.
- `POST /api/sessions`: план принадлежит пользователю, day_index — индекс массива days от 0, slugs принадлежат выбранному дню. Неизвестный/чужой план — одинаковый 422. `record_workout_session` повторяет проверки под блокировкой, записывает тренировку, XP и награды одной транзакцией. Ответ: xp_earned, coins_earned, balance; coins_earned включает недельный бонус, если он начислен этим вызовом.

Лимиты из economy.ts: максимум 20 упражнений, 10 подходов на упражнение, 60 подходов всего; reps — целое 1..100, weight_kg — 0..500. Повторные slugs запрещены. XP = min(100, 5 * число подходов), в том числе у повторной тренировки без коинов. Суммы и границы продублированы в SQL для защиты самой RPC; старые миграции ради удаления констант не менялись.

Обе RPC доступны только service_role, SECURITY INVOKER, search_path пуст. Они блокируют строку профиля, как существующий redeem, и требуют READ COMMITTED. Дневные 10 coins используют ref_id локальной даты пользователя; недельные 50 — дату понедельника ISO-недели. Оба правила защищены отдельными partial unique indexes, дополнительно к существующему общему индексу ledger.

Добавлена `workout_sessions.local_date`: снимок даты в timezone профиля при записи. Старые строки заполняются по timezone профиля на момент миграции. Бонус недели означает наличие хотя бы одной завершённой тренировки в каждую дату из текущих profiles.weekdays этой ISO-недели. Используются фактические даты завершения; day_index не позволяет заранее закрыть будущий день. Пустое расписание не даёт бонуса. Изменение расписания меняет критерий текущей недели; выданный бонус не отзывается и повторно не начисляется. Явные timestamps RPC доверены только service role для проверок; HTTP не принимает клиентские даты.

Streak использует существующий алгоритм и timezone профиля, пересчитывая checked_in_at. Незапланированный check-in даёт 40 coins, но не увеличивает streak; сегодняшний незавершённый запланированный день не обрывает его до конца дня.

Demo rate limit: QR 60 запросов/IP/минуту и 300/ключ/минуту; check-in 10/пользователь/минуту. Счётчики процесса ограничены 10000 ключами, ключи/IP хешируются. В serverless/нескольких процессах лимит НЕ общий, при перезапуске сбрасывается. Reverse proxy должен перезаписывать x-forwarded-for/x-real-ip: без этого клиент может подделать IP. Без заголовков используется общий unknown bucket.

Пока не реализованы plan/generate, plan/active, redeem API, billing, nutrition, partner/stats и UI входа. Существующая SQL-функция redeem сохранена, новых возможностей этого API не добавлялось. Главная страница временного каркаса — заглушка.

## Команды проверок

```powershell
pnpm install --frozen-lockfile
pnpm exec next build --webpack
pnpm exec tsc --noEmit --incremental false
node --test
node --conditions=react-server --test lib/server/http.test.ts lib/server/activity.test.ts
node scripts/verification/native-runner.mjs
```

Native runner использует существующие assertions.sql и concurrency.mjs: отдельные реальные PostgreSQL-соединения проверяют конкуренцию check-in и тренировок. БД локальная и одноразовая; Supabase Auth/PostgREST не заменяются утверждением о production end-to-end. Проверки HTTP-обработчиков в Node используют подставные HTTP-ответы Supabase; HMAC, схема и обработчик исполняются настоящие. Новых файлов инфраструктуры проверки нет.

В терминале с настроенными серверными переменными:

```powershell
pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3100
```

В другом терминале проверить QR без ключа и с ключом (демо UUID из seed):

```powershell
curl.exe -i http://127.0.0.1:3100/api/gyms/20000000-0000-4000-8000-000000000001/qr-token
curl.exe -i -H "x-gym-key: $env:GYM_ADMIN_KEY" http://127.0.0.1:3100/api/gyms/20000000-0000-4000-8000-000000000001/qr-token
curl.exe -i -H "x-gym-key: $env:GYM_ADMIN_KEY" http://127.0.0.1:3100/api/gyms/ffffffff-ffff-4fff-8fff-ffffffffffff/qr-token
```

Ожидания при готовом Supabase: 401, 200, 404. Для следующих команд нужны действительный пользовательский JWT в TEST_USER_JWT и принадлежащий ему план в TEST_PLAN_ID. Эти значения пользователь задаёт локально, передавать секреты в отчёт не нужно:

```powershell
curl.exe -i -H "Authorization: Bearer $env:TEST_USER_JWT" http://127.0.0.1:3100/api/me
$qr = Invoke-RestMethod -Uri 'http://127.0.0.1:3100/api/gyms/20000000-0000-4000-8000-000000000001/qr-token' -Headers @{'x-gym-key'=$env:GYM_ADMIN_KEY}
$checkin = @{gym_id='20000000-0000-4000-8000-000000000001'; token=$qr.token} | ConvertTo-Json -Compress
$checkin | curl.exe -i -H "Authorization: Bearer $env:TEST_USER_JWT" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/checkin --data-binary '@-'
$checkin | curl.exe -i -H "Authorization: Bearer $env:TEST_USER_JWT" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/checkin --data-binary '@-'
$session = @{plan_id=$env:TEST_PLAN_ID; day_index=0; exercises=@(@{slug=$env:TEST_EXERCISE_SLUG; sets=@(@{reps=10; weight_kg=0})})} | ConvertTo-Json -Depth 5 -Compress
$session | curl.exe -i -H "Authorization: Bearer $env:TEST_USER_JWT" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/sessions --data-binary '@-'
$session | curl.exe -i -H "Authorization: Bearer $env:TEST_USER_JWT" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/sessions --data-binary '@-'
```

TEST_EXERCISE_SLUG должен принадлежать первому дню указанного плана. Check-in возвращает 200/+40 и затем 409; новый день тренировок даёт 10 (или 60 при завершении недели), повтор — 0, но создаёт ещё workout_session. Live PostgREST smoke после всех миграций: `node scripts/postgrest-smoke.mjs`. Создание планов для demo остаётся отдельной задачей, поскольку plan/generate не входит в эту поставку.

Проверка RPC-прав и индексов в SQL Editor:

```sql
select has_function_privilege('anon', 'public.record_gym_checkin(uuid,uuid,timestamptz)', 'EXECUTE') as anon_checkin,
       has_function_privilege('authenticated', 'public.record_workout_session(uuid,uuid,integer,jsonb,timestamptz)', 'EXECUTE') as user_sessions,
       has_function_privilege('service_role', 'public.record_gym_checkin(uuid,uuid,timestamptz)', 'EXECUTE') as server_checkin;
-- Expected: false, false, true.
select indexname, indexdef from pg_indexes where schemaname='public'
  and indexname in ('coin_ledger_workout_day_once', 'coin_ledger_weekly_bonus_once');
select proname, prosecdef, proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and proname in ('record_gym_checkin', 'record_workout_session');
-- Expected: security invoker and an empty search_path for both functions.
```

## Реальные результаты текущего этапа

- `pnpm exec next build --webpack`: код 0, `Compiled successfully in 6.2s`; все семь API-маршрутов — dynamic. Первый sandbox-запуск остановился на EPERM при создании каталога `.next`; повтор с разрешением записи прошёл.
- `pnpm exec tsc --noEmit --incremental false`: код 0, вывод пустой.
- `node --test`: 34 tests, 34 pass, 0 fail, 0 skipped. Два из этих тестов — обёртки, внутри которых проходят 16 проверок авторизации и реальных обработчиков с подставными ответами Supabase. Отдельные прямые прогоны http.test.ts и activity.test.ts с `--conditions=react-server` также прошли: по 8 тестов.
- `node scripts/verification/native-runner.mjs`: код 0, `PASS: native PostgreSQL verification completed.` Проверены все три миграции, права, откаты, полночь зала, чужой план, недельный бонус и реальная конкуренция. Первый запуск встретил EACCES на loopback; следующий выявил устаревшие права временных SQL test helpers после миграции 002. Явные grants helpers исправлены, финальный полный прогон прошёл. Существующий runner и PostgreSQL остановлены штатно.
- Сверка контракта через Node: `PASS: draft exactly matches 17 proposal blocks; all 13 endpoint errors retain internal_error.`
- Реальный dev-сервер на 127.0.0.1:3100 с временным демонстрационным GYM_ADMIN_KEY: curl без ключа и с неверным ключом — HTTP 401 `invalid_gym_key`; с правильным временным ключом — HTTP 500 `internal_error`, поскольку Supabase не настроен. Серверный лог: `SERVER CONFIGURATION ERROR: Missing server configuration: SUPABASE_SERVICE_ROLE_KEY.` Клиенту возвращено только `An unexpected error occurred.` Dev-сервер остановлен.

Без ключей Supabase не запускались production Auth/REST, успешный QR с реальным залом, live PostgREST smoke, настоящий seed и HTTP check-in/sessions с действительной сессией. Локальный native PostgreSQL и mocked HTTP-тесты не обозначаются как end-to-end Supabase.
