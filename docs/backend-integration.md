# Передача backend после contract-v1

Ветка `BACK`. Временный каркас находится в отдельном коммите `fbc5138` (`chore: throwaway scaffold (do not merge)`). При переносе в Next.js-проект фронтенда его можно пропустить. Локальный тег `contract-v1` остаётся на `c6136e2`; он не перемещался. Актуальный контракт расширен поверх этой версии.

`docs/SPEC.md` отсутствует в checkout. Источник — ранее разрешённый PDF и `docs/contract-proposal.md`, с приоритетом текущих заданий пользователя. `lib/contract-draft/index.ts` дословно объединяет 18 TypeScript-блоков предложения; сервер импортирует их только через `lib/server/contract.ts`. `lib/contract/**` не изменён.

## Изменения контракта

- Commerce-этап: новый `POST /api/partner/simulate-purchase` и схемы/типы SimulatePurchase*. Реестр теперь содержит 14 эндпоинтов. Добавлены `invalid_qr_token` (422), `reward_not_found` (404), `reward_inactive` (409), `redemption_not_found` (404), `already_purchased` (409), `partner_not_found` (404). Новые ошибки включены в общие и соответствующие endpoint-union. В not_enough_coins используется разрешённое контрактом динамическое сообщение `You need N more coins.`. Обязательные поля существующих DTO и HTTP-коды существующих случаев не менялись; смена кода ошибки QR на invalid_qr_token прямо запрошена пользователем.
- Дополнение к AI-этапу не меняет Zod-схемы, DTO или коды ошибок. По прямому указанию пользователя лимит изображения уменьшен с 5 до 4 МиБ. 503 catalog_unavailable и 422 до вызова AI больше не расходуют квоту; отсутствие AI-конфигурации по-прежнему возвращает запасной план с 200, теперь без попытки.
- AI-этап: добавлены `CatalogUnavailableErrorSchema` / `CatalogUnavailableResponseSchema` и выведенные типы для HTTP 503 `catalog_unavailable`; добавлены `AiUnavailableErrorSchema` / `AiUnavailableResponseSchema` и типы для HTTP 503 `ai_unavailable`. Общие error-union расширены. Первый код доступен plan/generate, второй — nutrition/analyze.
- В plan/generate добавлен существующий HTTP 402 `pro_required` для Free-квоты. Незавершённая анкета сохраняет 422 `validation_error`, Pro-квота — 429 `rate_limited`. Формы успешных ответов не изменены, обязательные поля не добавлены.
- Добавлены `GymNotFoundErrorSchema`, `GymNotFoundResponseSchema`, их выведенные типы и сообщение `The gym was not found.`: HTTP 404 `gym_not_found` в общих ошибках и QR-маршруте.
- В ошибки QR-маршрута добавлен существующий HTTP 429 `rate_limited`.
- По прямому указанию пользователя QR-маршрут не требует сессии, но требует `x-gym-key`; Bearer JWT добавлен как запасной способ авторизации остальных маршрутов.
- Неизвестный зал check-in сохраняет HTTP 422 `validation_error`. Неверный/просроченный токен теперь даёт HTTP 422 `invalid_qr_token` по прямому заданию пользователя.
- Схемы запросов и успешных ответов не изменены. Новые границы нагрузок проверяются как бизнес-правила по явному заданию пользователя, без изменения типов Zod-контракта.
- Ранее согласованный HTTP 500 `internal_error` с точным сообщением `An unexpected error occurred.` остаётся во всех 14 схемах ошибок. Поля nutrition `confidence` и `disclaimer` сохранены.

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
| AI_API_KEY | Только сервер: ключ AI-провайдера, без NEXT_PUBLIC-варианта |
| AI_BASE_URL | Только сервер: базовый URL API, к которому добавляется /chat/completions |
| AI_MODEL | Только сервер: имя модели в запросе |
| DEMO_EMAIL | Только seed-demo: адрес основного демо-аккаунта |
| DEMO_PASSWORD | Только seed-demo: пароль создаваемых демо-аккаунтов |
| DEMO2_EMAIL | Только seed-demo: адрес второго аккаунта без анкеты |

Для работы нужны URL, anon key, service role и GYM_ADMIN_KEY. Значения секретов не должны попадать в Git, ответы или логи. У service role и gym key нет вариантов NEXT_PUBLIC. `TEST_DATABASE_URL` и `TEST_DATABASE_DISPOSABLE=1` нужны только существующему SQL runner; native-runner сам задаёт их для изолированной локальной БД. Seed и live PostgREST smoke используют серверные SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY по своей документации; видео-валидатор ключей не требует.

Для вызова модели нужны все три AI-переменные; отсутствие конфигурации приводит к запасному плану при достаточном каталоге и к 503 ai_unavailable у nutrition. Секреты не логируются, публичные AI-переменные игнорируются.

Для переноса `.ts` импортов нужны `allowImportingTsExtensions: true`, `noEmit: true`, DOM-типы для контрактного `File`, Next.js App Router. Применяются все семь миграций в порядке имени; уже применённые 001–005 не переписаны. Новых зависимостей для AI нет: используются fetch, node:http в тестах и существующий Zod 4.

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

Redeem, billing, partner/stats и partner/simulate-purchase реализованы. UI входа и главная страница временного каркаса остаются вне backend-задачи.

## AI-план и nutrition

`POST /api/plan/generate` принимает `{}` после авторизации. Полная анкета проверяется до резервирования квоты; незаполненная или невалидная анкета даёт 422. Имя, user ID, timezone и подписка не отправляются модели: AI получает только поля QuestionnaireSchema, серверный plan UUID, допустимые slug и их мышечные группы в JSON-значениях отдельного user-message. System prompt статический и основан на английском промпте PDF, стр. 13. Вредоносная строка в injuries.area отвергается enum-схемой; свободное injuries.when остаётся JSON-данными, а не частью инструкций. Структурирование JSON не заменяет последующие проверки допустимых упражнений.

Миграция 004 создаёт `app_private.plan_generation_attempts`: RLS включён, клиентским ролям закрыты схема и таблица. В public по-прежнему 13 таблиц, во внутренней схеме добавлена одна. `reserve_plan_generation` с advisory lock считывает часы после получения блокировки и атомарно резервирует попытку. Free — одна попытка за последние 168 часов; истечение ровно 168 часов освобождает слот. Pro определяется только актуальным current_period_end, лимит — 10 попыток в локальный календарный день профиля, с учётом DST. Отклонённый запрос новую попытку не создаёт.

Тело запроса, анкета, доступность отфильтрованного каталога и AI-конфигурация проверяются до резервирования. Ошибки 422 и 503 catalog_unavailable не создают попыток: повтор с пустым каталогом снова даёт 503, а после наполнения каталогом Free-слот остаётся доступен. Затем попытка резервируется атомарно отдельным RPC перед обращением к AI. После начала AI-запроса попытка остаётся потраченной, в том числе при таймауте, ответе с ошибкой, запасном плане или ошибке сохранения. Один HTTP-запрос генерации допускает один внутренний повтор модели при ошибке JSON/схемы/семантики.

Каталог выбирается с verified=true, non-null/nonempty video_youtube_id; те же условия и пригодность метаданных повторно проверяются локально. Ongoing-травмы исключают упражнения до AI; recovered передаются с областью и датой. `none` допускает только bodyweight; любой набор также допускает bodyweight, `full_gym` трактуется как доступ к full_gym/dumbbells/bands/none. Требуется минимум уникальных упражнений по длительности: 20→3, 30→4, 45→5, 60→6, 75→7. Для нескольких дней требуется минимум две мышечные группы, чтобы запасной план мог чередовать акцент. Недостаточный каталог — 503; обычный seed содержит только unverified-видео, поэтому требует ручного наполнения перед успешной генерацией.

После Zod проверяются точные weekdays, длительность, диапазоны количества упражнений 3–4 / 4–5 / 5–6 / 6–8 / 7–9 и совместимость числа подходов с лимитами журнала. Неизвестные slug удаляются; если минимум нарушен — один повтор, затем запасной план. AI-схема не сообщает группу неизвестного slug, поэтому группа не угадывается. Name/video всегда подставляются из разрешённого каталога, UUID — серверный. При ongoing сервер обязательно добавляет `Consult a doctor before exercising with an ongoing injury.`

Таймаут/недоступность/отсутствие AI-конфигурации сразу включают детерминированный запасной план из тех же упражнений. Он сохраняет дни и время, использует минимум упражнений, два подхода, 8–10 повторений, 60 секунд отдыха, чередует акцент мышечных групп. Контент при одинаковых входах детерминирован, новый plan UUID уникален; fallback не выдаётся за результат успешного вызова модели в отчёте. В успешном DTO нет дополнительного is_fallback.

`save_generated_plan` атомарно деактивирует предыдущий план, создаёт новый, сохраняет ровно анкету QuestionnaireSchema в input_snapshot, помечает использованную попытку и выдаёт +20 через существующий уникальный first_plan индекс. Повтор сохранения одной попытки возвращает прежний план без награды. Миграция 005 добавляет `save_fallback_plan` для отсутствующей/невалидной AI-конфигурации: тот же атомарный active-план, снимок и одноразовая награда, но без строки попытки и без обращения к модели. Существующий save_generated_plan по-прежнему требует собственную зарезервированную попытку. Все три RPC доступны только service_role, SECURITY INVOKER с пустым search_path. `GET /api/plan/active` возвращает проверенный Plan DTO либо 404 plan_not_found.

`POST /api/nutrition/analyze` проверяет срок Pro до чтения multipart и до AI. Не-Pro — 402 и ноль обращений к модели. Разрешены JPEG/PNG/WebP по magic bytes, максимум 4 МиБ (4×1024² = 4194304 байта, включительно); 4194305 байт дают 422 до AI и записи food_logs. Константа находится в economy.ts. MIME-заголовок файла не является доказательством формата. Проверяется сигнатура, не полное декодирование изображения. Multipart ограничен размером файла плюс 64 КиБ служебной оболочки, принимается ровно одно поле image. Фото передаётся как data URL, не сохраняется. Результат проверяется NutritionSuccessSchema; totals пересчитывается, если расхождение с суммой items превышает 0.01 по любому нутриенту. Ошибка AI — 503 ai_unavailable, без подставных значений. В food_logs записываются только user_id и result_json; image_path стал nullable. Лимит — 10 запросов пользователя в минуту, с прежними ограничениями памяти процесса/serverless.

Общий AI-бюджет plan/generate — 40 секунд, включая повтор: timeout каждого обращения равен минимуму 25 секунд и остатка общего бюджета. Deadline использует монотонные часы, прерывает текущий fetch и включает запасной план. Маршрут экспортирует maxDuration=60; обе величины заданы в economy.ts. Для статического анализатора Next.js в route необходим числовой литерал 60; тип `typeof ECONOMY.ai.planRouteMaxDurationSeconds` и тест равенства не дают значениям разойтись. Оставшиеся 20 секунд — запас на инфраструктуру, а не установленный таймаут Supabase. Длительность всего HTTP-запроса зависит также от БД и ограничений хостинга.

## Сброс попыток демо-пользователя

Выполнить владельцем БД в Supabase SQL Editor, заменив `demo@example.com` точным адресом демо-пользователя. У service_role нет DELETE на внутренней таблице. Перед сбросом дождаться завершения генераций этого пользователя: AI выполняется между транзакциями резервирования и сохранения. SQL удаляет только его попытки; планы, подписка и ledger, включая уже выданные +20, сохраняются. `INTO STRICT` прекращает операцию при отсутствии или неоднозначности адреса. Блокировки согласованы с резервированием квоты и сохранением плана.

```sql
begin;
do $$
declare
    v_user_id uuid;
    v_deleted integer;
begin
    select id into strict v_user_id
    from auth.users
    where email = 'demo@example.com';

    perform pg_catalog.pg_advisory_xact_lock(
        pg_catalog.hashtextextended('plan-generation:' || v_user_id::text, 0)
    );
    perform 1 from public.profiles where id = v_user_id for update;
    if not found then
        raise exception 'Demo profile was not found.';
    end if;

    delete from app_private.plan_generation_attempts where user_id = v_user_id;
    get diagnostics v_deleted = row_count;
    raise notice 'Deleted % generation attempts.', v_deleted;
end;
$$;
commit;
```

## Требует сверки

Официальная документация фактического AI-провайдера не предоставлена и не проверялась. Весь специфичный формат собран в `openAiCompatibleFormat` в ai.ts. Перед подключением нужны подтверждения:

- URL POST `{AI_BASE_URL}/chat/completions`, авторизация `Authorization: Bearer`, точное значение AI_MODEL.
- Поддержка `response_format: {type: "json_schema", json_schema: {name, strict: true, schema}}`, схемы draft-7 и её ограничений/format.
- Поддержка `reasoning_effort: "low"` совместно с JSON Schema и изображениями. Значение `none` код никогда не отправляет.
- Поддержка multipart-content сообщений с `image_url.url` в виде data URL для JPEG/PNG/WebP и реальных лимитов размера.
- Ответ в строковом `choices[0].message.content`, семантика refusal и HTTP-ошибок. Иные envelope/streaming/tool-call форматы пока не поддерживаются.

Таймаут одного AI-вызова — не более 25 секунд, включая чтение тела; у плана максимум два вызова с общим бюджетом 40 секунд. Ответ ограничен 1 МиБ, redirects запрещены. Реальные скорость, стоимость, совместимость схем, качество планов и оценок питания не проверены без ключей. Локальный fake подтверждает только принятое допущение протокола.

## Команды проверок

```powershell
pnpm install --frozen-lockfile
node --use-system-ca node_modules/next/dist/bin/next build --webpack
node --use-system-ca node_modules/typescript/bin/tsc --noEmit --incremental false
node --use-system-ca --test
node --use-system-ca --conditions=react-server --test lib/server/http.test.ts lib/server/activity.test.ts
node --use-system-ca --conditions=react-server --test lib/server/ai-nutrition.test.ts lib/server/plans.test.ts
node --use-system-ca scripts/verification/native-runner.mjs
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

TEST_EXERCISE_SLUG должен принадлежать первому дню указанного плана. Check-in возвращает 200/+40 и затем 409; новый день тренировок даёт 10 (или 60 при завершении недели), повтор — 0, но создаёт ещё workout_session. Live PostgREST smoke после всех миграций: `node --use-system-ca scripts/postgrest-smoke.mjs`. Создание планов для demo остаётся отдельной задачей, поскольку plan/generate не входит в эту поставку.

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

## Проверки предыдущего этапа (QR и тренировки)

- `node --use-system-ca node_modules/next/dist/bin/next build --webpack`: код 0, `Compiled successfully in 6.2s`; все семь API-маршрутов — dynamic. Первый sandbox-запуск остановился на EPERM при создании каталога `.next`; повтор с разрешением записи прошёл.
- `node --use-system-ca node_modules/typescript/bin/tsc --noEmit --incremental false`: код 0, вывод пустой.
- `node --use-system-ca --test`: тогда сообщил 34 pass, но позднее обнаружено, что унаследованный NODE_TEST_CONTEXT мог пропускать дочерние тесты. Прямые прогоны http.test.ts и activity.test.ts с `--conditions=react-server` действительно прошли: по 8 тестов. На текущем AI-этапе все обёртки исправлены и перепроверены, как описано ниже.
- `node --use-system-ca scripts/verification/native-runner.mjs`: код 0, `PASS: native PostgreSQL verification completed.` Проверены все три миграции, права, откаты, полночь зала, чужой план, недельный бонус и реальная конкуренция. Первый запуск встретил EACCES на loopback; следующий выявил устаревшие права временных SQL test helpers после миграции 002. Явные grants helpers исправлены, финальный полный прогон прошёл. Существующий runner и PostgreSQL остановлены штатно.
- Сверка контракта через Node: `PASS: draft exactly matches 17 proposal blocks; all 13 endpoint errors retain internal_error.`
- Реальный dev-сервер на 127.0.0.1:3100 с временным демонстрационным GYM_ADMIN_KEY: curl без ключа и с неверным ключом — HTTP 401 `invalid_gym_key`; с правильным временным ключом — HTTP 500 `internal_error`, поскольку Supabase не настроен. Серверный лог: `SERVER CONFIGURATION ERROR: Missing server configuration: SUPABASE_SERVICE_ROLE_KEY.` Клиенту возвращено только `An unexpected error occurred.` Dev-сервер остановлен.

Без ключей Supabase не запускались production Auth/REST, успешный QR с реальным залом, live PostgREST smoke, настоящий seed и HTTP check-in/sessions с действительной сессией. Локальный native PostgreSQL и mocked HTTP-тесты не обозначаются как end-to-end Supabase.

## Реальные результаты AI-этапа

- `pnpm exec next build --webpack`: код 0, `Compiled successfully in 2.4s`; все десять API-маршрутов dynamic, включая plan/generate, plan/active и nutrition/analyze.
- `pnpm exec tsc --noEmit --incremental false`: код 0, вывод пустой.
- Финальный `node --test`: 36 tests, 36 pass, 0 fail, 0 skipped, 3342.9184 ms. Четыре обёртки запускают 8 + 8 + 9 + 12 внутренних проверок и теперь проверяют реальные TAP counts, а не только код выхода. NODE_TEST_CONTEXT удаляется из окружения дочернего runner; рекурсивный пропуск тестов вызывает FAIL. Прямые прогоны AI/nutrition и plans также прошли: 9 и 12 тестов.
- В timeout-тесте план вернулся примерно за 80–92 ms при тестовом лимите 75 ms и задержке фейка 1200 ms; выполнен один AI-запрос, затем fallback. Production timeout остаётся 25 s.
- `node scripts/verification/native-runner.mjs`: код 0, `PASS: native PostgreSQL verification completed.` Все прежние assertions прошли. Новые проверки подтвердили rolling 168h/DST, актуальную подписку, Pro 6/10/11, полночь профиля, one-time +20, один active план, rollback и реальную конкуренцию Free через advisory lock. Native PostgreSQL остановлен, тестовые данные удалены/откачены. Журнал находится в игнорируемом `scripts/verification/.cache/postgres-kyLwvJ/commands.log`.
- `git diff --numstat a117387 -- scripts/verification/assertions.sql`: `194 0` — ни одна прежняя строка не удалена. Исходные 28299 байт сохранены дословно, SHA-256 `872a1a80417936e2965603d087e3e395df5b88a60b17ace16fb58b8e950ac2cc`. Нормализованный префикс также совпадает с Git-версией a117387. Новые проверки добавлены после прежнего содержимого отдельной транзакцией.
- Сверка contract draft с 17 блоками предложения и проверка новых error-union: PASS. Первые три миграции, корневые зависимости и каркас не изменены.

Настоящие AI и Supabase не вызывались: ключей нет. Фейки — реальные локальные HTTP-серверы с контролируемыми ответами; квоты и транзакции дополнительно проверены настоящим локальным PostgreSQL. Проверка payload подтверждает фильтры травм/оборудования, отсутствие display_name и reasoning_effort=low. Проверка не-Pro подтверждает 402 и ноль запросов к fake AI. Это не проверка качества модели, провайдера или production-интеграции.

## Повторная проверка AI и сохранности SQL-тестов

```powershell
node --use-system-ca --test
node --use-system-ca --conditions=react-server --test lib/server/plans.test.ts lib/server/ai-nutrition.test.ts
node --use-system-ca scripts/verification/native-runner.mjs
git diff --numstat a117387 -- scripts/verification/assertions.sql
@'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const old = execFileSync('git', ['show', 'a117387:scripts/verification/assertions.sql'], {encoding:'utf8'}).replace(/\r\n/g,'\n');
const current = readFileSync('scripts/verification/assertions.sql','utf8').replace(/\r\n/g,'\n');
assert.ok(current.startsWith(old));
console.log('PASS: every original SQL assertion remains unchanged.');
'@ | node --use-system-ca --input-type=module
```

Команды ниже требуют реальных настроенных сервисов, проверенного каталога, пользовательского JWT и локального изображения. Они здесь **не запускались**:

```powershell
curl.exe -i -X POST http://127.0.0.1:3100/api/plan/generate -H "Authorization: Bearer $env:TEST_USER_JWT" -H 'Content-Type: application/json' --data '{}'
curl.exe -i http://127.0.0.1:3100/api/plan/active -H "Authorization: Bearer $env:TEST_USER_JWT"
curl.exe -i -X POST http://127.0.0.1:3100/api/nutrition/analyze -H "Authorization: Bearer $env:TEST_USER_JWT" -F "image=@$env:TEST_IMAGE_PATH"
```


## Commerce и демо: новые миграции 006–007

Применять вручную в Supabase SQL Editor по одному файлу: сначала supabase/migrations/202611140006_commerce.sql, затем supabase/migrations/202611140007_demo_seed.sql. Уже применённые 001–005 не редактировались. Новые файлы самодостаточны поверх предыдущих миграций, без psql-команд; используют CREATE OR REPLACE / IF NOT EXISTS, явно закрывают EXECUTE для PUBLIC/anon/authenticated и выдают service_role. Последняя команда каждого файла — NOTIFY pgrst, 'reload schema';. Новых таблиц нет.

Миграция 005 уже сохранена в коммите f56186a: она добавляет save_fallback_plan. Функция в одной транзакции под блокировкой профиля сохраняет запасной план, меняет активную версию и выдаёт первые +20 один раз. Попытку генерации она не создаёт. Это соответствует квоте: отсутствие AI-конфигурации приводит к fallback без AI и без попытки; если AI был вызван и затем потребовался fallback, используется save_generated_plan с уже зарезервированной попыткой. Ошибки анкеты, тела запроса и каталога происходят до резервирования. Миграция 007 использует тот же путь без AI для демо-данных.

### Новые маршруты

- POST /api/rewards/redeem: withAuth, строгий reward_id, один вызов трёхаргументного redeem_reward. Отсутствующая награда — 404 reward_not_found, неактивная — 409 reward_inactive, нехватка — 402 not_enough_coins с проверенным положительным целым N из SQL DETAIL. Никакой повторной логики списания в маршруте нет. Pro продлевается от максимума текущего конца и времени операции, source=coin_redemption. Node crypto.randomBytes создаёт 32 кандидата SHOWUP-XXXXXX без 0/O/1/I; SQL перебирает коллизии под уникальным индексом в той же транзакции. Исчерпание всего пула откатывает операцию и даёт безопасный 500.
- POST /api/billing/subscribe: принимает прежний контракт {plan:"pro_monthly"}. mock_subscribe под блокировкой возвращает существующий активный срок без продления; иначе создаёт 30 дней с source=mock_payment. Реального платёжного провайдера нет.
- POST /api/partner/simulate-purchase: принимает {redemption_id}; чужой/неизвестный — 404, награда другого вида — 422, повтор — 409 already_purchased. Корзина ECONOMY.demoPurchaseAmountCents=4000; сумма не берётся от клиента. Комиссия округляется вниз до целого цента: точное numeric в SQL и целочисленная арифметика в calculateCommissionCents. Индекс partner_sales_redemption_once запрещает вторую продажу одной награды.
- GET /api/partner/stats?partner_id=: доступен любой авторизованной сессии для демо. Невалидный UUID/лишние query-поля — 422, неизвестный партнёр — 404, пустая статистика — три нуля. Агрегация выполняется одним серверным RPC.

Существующая двухаргументная redeem_reward сохранена для совместимости прежних SQL-проверок и service-role клиентов: у неё историческое source='coins' и прежний формат промокода. Новый HTTP API всегда передаёт третий аргумент p_promo_codes и использует правила 006. Старый API не открыт клиентским ролям. Это намеренное ограничение совместимости, а не подмена проверки новой реализации.

coin_balance остаётся SECURITY INVOKER с RLS; authenticated может передать произвольный UUID, но видит только собственные ledger-строки. Для чужого UUID возвращается 0 независимо от реального баланса. Добавлены SQL-проверки с положительными разными балансами A/B и пять live smoke-кейсов (service role, собственные и чужие балансы). /api/me продолжает использовать прежний RPC. Оснований менять его grants не найдено.

### Демо-аккаунты

scripts/seed-demo.mjs сначала читает проверенный каталог и зал America/Chicago. Требуется минимум пять подходящих упражнений и минимум две мышечные группы; verified=true, заполненные video_youtube_id/video_title остаются обязательными. При недостатке каталога нет Auth-мутаций. --dry-run не делает сетевых запросов, даже без env.

Основной аккаунт получает расписание [1,3,5], 45 минут, full_gym, отсутствие травм, America/Chicago и план из того же fallbackPlan. seed_demo_account в 007 атомарно записывает профиль, план, три посещения и три тренировки за предыдущую ISO-неделю через обычные reward RPC. Для нового аккаунта это 20 + 3×40 + 3×10 + 50 = 220 коинов, восемь ledger-строк. Стабильный UUID плана зависит от пользователя и версии seed; повтор, даже через неделю, не создаёт новых строк и не переактивирует старый план.

Второй аккаунт остаётся без анкеты. Для обоих вновь созданных аккаунтов используется DEMO_PASSWORD; существующие пароли не меняются. Если у существующего второго аккаунта уже есть анкета, seed прекращается до записи. При ошибке RPC удаляются только аккаунты, созданные текущим запуском. Auth и SQL не составляют одну общую транзакцию: при сбое cleanup выводится безопасное сообщение и требуется проверить Auth вручную. Адреса и пароли не логируются.

### Команды текущего этапа

Все команды Node используют --use-system-ca. Они не отключают TLS-проверку. Если aliases нужны скрипту, создавайте их только в окружении процесса; не записывайте ключи в новые файлы.

```powershell
node --use-system-ca node_modules/next/dist/bin/next build --webpack
node --use-system-ca node_modules/typescript/bin/tsc --noEmit --incremental false
node --use-system-ca --test
node --use-system-ca scripts/verification/native-runner.mjs
node --use-system-ca scripts/seed-demo.mjs --dry-run
node --use-system-ca --conditions=react-server --test --test-reporter=tap lib/server/commerce.test.ts scripts/seed-demo.test.mjs
node --use-system-ca --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; process.env.SUPABASE_ANON_KEY=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY; await import('./scripts/postgrest-smoke.mjs')"
```

Последняя команда — живой smoke с созданием и удалением тестовых аккаунтов; на этом этапе она не запускалась. Новые миграции не применялись к вашему Supabase автоматически, AI не вызывался. Миграции проверяются локальным native PostgreSQL, HTTP и seed-demo — фейковыми серверами. Существующий SQL сброса попыток у одного демо-пользователя приведён выше и не сбрасывает ledger.


## AI Coach: POST /api/assistant

Добавлен обратно-совместимый маршрут для существующего экрана Coach. Общие схемы запроса и ответа находятся в lib/contract/assistant.ts и совпадают с предложением lib/client/assistant-contract.ts. Сервер получает их через lib/server/contract.ts. Маршрут требует сессию, ограничен 10 запросами в минуту на пользователя и вызывает существующий AI adapter с maxDuration=60. Профиль, активный план, баланс и streak читаются только для текущего пользователя; имя, идентификаторы аккаунта и видео не отправляются модели. История чата не записывается в базу.

AI_API_KEY отвечает за доступ к сервису, AI_BASE_URL задаёт адрес сервиса, AI_MODEL выбирает модель. Все три значения нужны для обращения к реальной модели. По одному ключу адрес не определяется; адрес чужого провайдера нельзя подставлять автоматически. При пустом AI_BASE_URL или другой неполной конфигурации Coach отвечает 503 ai_unavailable до чтения контекста и обращения к AI. Это не тот же случай, что 404 отсутствующего маршрута. Запасной алгоритм планов не заменяет чат выдуманными ответами.

Настройка AI-провайдера и совместимость с POST /chat/completions, response_format=json_schema и reasoning_effort=low по-прежнему требуют сверки с его документацией. Значения окружения и запросы пользователя в логи не выводятся.

## Безопасная проверка секретов

Следующая команда проверяет все достижимые Git blobs и отслеживаемые/неигнорируемые файлы рабочего дерева на точные непустые значения из .env.local, включая повторные определения переменных. Она печатает только имя переменной и место совпадения, без значений. Локальный env, зависимости и игнорируемые build/cache-артефакты исключены из поиска рабочего дерева; это не обещание аудита всех локальных файлов на компьютере. История проверяется целиком по всем refs; автоматически не переписывается.

```powershell
@'
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
try {
  const git = args => execFileSync('git', args, {maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']});
  const source = readFileSync('.env.local','utf8');
  const values = new Map();
  for (const part of [source, ...source.split(/\r?\n/)]) {
    for (const [name,value] of Object.entries(parseEnv(part))) {
      if (value) values.set(name+'\0'+value, {name,bytes:Buffer.from(value)});
    }
  }
  const needles = [...values.values()];
  const files = [...new Set(git(['ls-files','-co','--exclude-standard','-z']).toString().split('\0').filter(Boolean))];
  const findings = [];
  for (const path of files) {
    const bytes = readFileSync(path);
    for (const item of needles) if (bytes.includes(item.bytes)) findings.push({scope:'worktree',path,variable:item.name});
  }
  const ids = git(['rev-list','--objects','--all']).toString().trim().split('\n').map(line=>line.split(' ')[0]);
  const metadata = execFileSync('git',['cat-file','--batch-check=%(objectname) %(objecttype)'],{
    input:ids.join('\n')+'\n',encoding:'utf8',maxBuffer:64*1024*1024,stdio:['pipe','pipe','pipe']
  });
  const blobs = metadata.trim().split('\n').filter(line=>line.endsWith(' blob')).map(line=>line.split(' ')[0]);
  for (const object of blobs) {
    const bytes = git(['cat-file','blob',object]);
    for (const item of needles) if (bytes.includes(item.bytes)) findings.push({scope:'history',object,variable:item.name});
  }
  const historicalEnvFiles = [...new Set(git(['log','--all','--pretty=format:','--name-only']).toString().split('\n')
    .filter(path=>/(^|\/)\.env(?:\.|$)/.test(path)))];
  console.log(JSON.stringify({worktree_files:files.length,history_blobs:blobs.length,
    checked_variables:[...new Set(needles.map(item=>item.name))],findings,historical_env_files:historicalEnvFiles}));
  process.exitCode = findings.length || historicalEnvFiles.length ? 1 : 0;
} catch {console.log('FAIL: secret audit could not complete; details suppressed.');process.exitCode=1;}
'@ | node --use-system-ca --env-file=.env.local --input-type=module
git check-ignore .env.local scripts/verification/node_modules
git ls-files -- scripts/verification/node_modules
git log --all --format='%h %s' --grep='throwaway scaffold'
```
