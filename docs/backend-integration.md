# Передача backend, contract-v1

Работа выполнена в ветке `BACK`. Первый коммит `fbc5138` — `chore: throwaway scaffold (do not merge)` — содержит только временный каркас. Его можно пропустить при переносе в Next.js-проект фронтенда. Коммит `c6136e2` и локальный аннотированный тег `contract-v1` фиксируют `docs/contract-proposal.md`, точную сборку его 17 TypeScript-блоков в `lib/contract-draft/index.ts` и единственный адаптер `lib/server/contract.ts`. Тег не отправлен в remote.

`docs/SPEC.md` отсутствует в этом checkout. Использован ранее разрешённый пользователем PDF; текущие схемы взяты из предложения контракта. Исторические разделы предложения описывают состояние предыдущих этапов; актуальный объём реализации описан здесь.

## Изменения контракта

- По явному подтверждению добавлены `InternalErrorSchema`, `InternalErrorResponseSchema` и выведенные типы `InternalError`/`InternalErrorResponse`.
- HTTP 500 с телом `{"error":{"code":"internal_error","message":"An unexpected error occurred."}}` включён в общую схему ошибок, все 13 схем тела ошибки и все 13 схем `{status, body}`. Сообщение закреплено литералом.
- Других изменений схем на этом этапе нет. Уже существовавшие `confidence` и `disclaimer` ответа nutrition сохранены. `lib/contract/**` не изменён. Сервер импортирует схемы только через `lib/server/contract.ts`; при согласовании общего контракта меняется этот файл.

## Требования при переносе

- Node.js 22.18+ с нативным исполнением TypeScript без преобразующих TypeScript-конструкций. Проверено на Node.js 24.22.1.
- Рабочий Next.js App Router, React, TypeScript; серверные зависимости `@supabase/ssr`, `@supabase/supabase-js`, `zod` версии 4, `server-only`.
- Проверенные версии находятся в lockfile временного каркаса. Тесты используют встроенный `node:test`, новых тестовых зависимостей нет.
- Для явных `.ts` в импортах нужны `allowImportingTsExtensions: true` и `noEmit: true`; для контрактного `File` — DOM-типы. Отдельный `scripts/verification` исключён из TypeScript-проекта, его `node_modules` игнорируется Git и не является workspace корневого пакета.
- Последовательно применить обе существующие миграции Supabase, затем при необходимости выполнить seed. Старые миграции в этом этапе не переписывались.
- Серверу нужны `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. Для URL/anon key поддерживаются также `NEXT_PUBLIC_SUPABASE_URL` и `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Service role не должен иметь префикс `NEXT_PUBLIC_`.
- Фронтенд должен использовать Supabase SSR cookie-сессию со стандартными именами `sb-…-auth-token`. Каждый запрос проверяется через `auth.getUser()`. Один заголовок Bearer или сессия только в localStorage не заменяют cookie-сессию этого контракта.

## Реализованное поведение

Все четыре обработчика проходят через `withAuth`. Успешные ответы проверяются Zod. Ошибка входных данных возвращает 422, отсутствие сессии — 401, непредвиденная ошибка — фиксированный 500. Ответы запрещают кеширование и содержат `Vary: Cookie`. В серверный лог попадают категория ошибки, безопасный код и статус; произвольные сообщения провайдеров, тела запросов и секреты не логируются.

- `GET /api/me`: профиль через RLS, баланс через `coin_balance`, streak, Pro по `current_period_end > now`, наличие активного плана. Возвращаемый `profile.is_pro` согласуется с верхним `is_pro`; устаревшее поле в БД не меняется при чтении.
- `POST /api/onboarding`: строгая схема анкеты, существование выбранного домашнего зала, сохранение только полей схемы для проверенного пользователя через admin-клиент. Необязательная timezone при отсутствии сохраняет прежнее значение; для нового профиля миграция задаёт `America/New_York`.
- `GET /api/gyms`: выбираются только `id,name,city,address`, без чтения `qr_secret` в этом запросе.
- `GET /api/rewards`: только активные награды и поля DTO.

Каталоги читаются admin-клиентом только после авторизации, поскольку прямой SELECT клиентским ролям закрыт миграцией. Списки и история отметок читаются страницами до конца, включая проекты с лимитом PostgREST меньше 1000 строк.

Streak рассчитывается по текущим `profiles.weekdays` и timezone профиля. Даты отметок получаются из `checked_in_at` в этом поясе, а не из `gym_checkins.local_date` зала. Истории расписаний и часовых поясов в модели нет: изменение анкеты пересчитывает прошлые даты по текущим настройкам. Сегодняшний незавершённый запланированный день не обрывает streak до полуночи. Незапланированные отметки не влияют на streak. Начисление коинов здесь ещё не реализовано.

`economy.ts` содержит награды, цены, комиссии, лимиты и XP `min(100, 5 * totalSets)`; seed берёт бизнес-числа из него. Выбран лимит Pro 10 генераций в день из раздела безопасности PDF, несмотря на «без лимита» в продуктовой таблице; применение лимита относится к будущему plan/generate. SQL-константа 30 дней в существующей функции redeem сохранена: изменение уже созданной миграции не выполнялось.

Пока отсутствуют API plan/generate, plan/active, sessions, QR/checkin, redeem, billing, nutrition, partner/stats, UI входа и начисление коинов. Они не заменены моками. Главная страница каркаса — заглушка.

## Реальные проверки этого этапа

- `pnpm exec next build` с Turbopack завершился ошибкой `TurbopackInternalError: Failed to write app endpoint /page` при обработке CSS. Для временного каркаса выбран Webpack.
- `pnpm exec next build --webpack` завершился с кодом 0: `Compiled successfully`, TypeScript и генерация страниц успешны; четыре `/api/*` маршрута отмечены как dynamic.
- `node --test`: 18 tests, 18 pass, 0 fail, 0 skipped. Покрыты две timezone на границе воскресенья/понедельника, оба перехода DST, границы календаря, пустое расписание, пропуск прошлого дня, незавершённый сегодняшний день, незапланированные/повторные отметки и XP.
- `pnpm exec tsc --noEmit --incremental false`: код 0, вывод пустой.
- Встроенные проверки HTTP-хелперов с подставным Auth-клиентом прошли: 401, 422, безопасный 500, проверка выходной схемы и запрет кеширования. Это не интеграция с Supabase.
- На реально запущенном `next dev --webpack --hostname 127.0.0.1 --port 3100` все четыре curl без cookie получили HTTP 401 и `{"error":{"code":"unauthorized","message":"Sign in to continue."}}`.
- Запрос `/api/me` с заведомо фиктивной cookie `sb-probe-auth-token=not-a-session` при отсутствии переменных Supabase получил HTTP 500 с точным `internal_error`, без подробностей исключения. Это проверка ошибки конфигурации, не тест действительной сессии.
- `node scripts/seed.mjs --dry-run`: `Dry run passed: 3 partners, 3 gyms, 3 rewards, 55 exercises.` Запросов в БД не было.
- `node scripts/validate-exercise-videos.mjs`: `Catalog rows: 55; checked: 0; passed: 0; problems: 0; skipped: 55.` Все ID отсутствуют; ни одно видео не проверялось, запросов в сеть не было.
- `git check-ignore -v scripts/verification/node_modules/zod/package.json` подтвердил правило `scripts/verification/.gitignore:1:node_modules/`.

Ключей Supabase в окружении нет. Успешные authenticated HTTP-запросы, применение миграций к Supabase, настоящий seed и `scripts/postgrest-smoke.mjs` на этом этапе не запускались. Dev-сервер после проверок остановлен. Существующая инфраструктура `scripts/verification` сохранена без расширения; её исторические проверки этого этапа не запускались и не считаются актуальным end-to-end доказательством.

## Команды воспроизведения

Из корня проекта с Node.js 22.18+:

```powershell
pnpm install --frozen-lockfile
pnpm exec next build --webpack
node --test
pnpm exec tsc --noEmit --incremental false
node scripts/seed.mjs --dry-run
node scripts/validate-exercise-videos.mjs
git check-ignore -v scripts/verification/node_modules/zod/package.json
git show --stat fbc5138
git show --stat contract-v1
```

Проверка дословного переноса схем и HTTP 500 для всех 13 эндпоинтов без БД:

```powershell
@'
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as c from "./lib/server/contract.ts";
const source = readFileSync("docs/contract-proposal.md", "utf8").replace(/\r\n/g, "\n");
const blocks = [...source.matchAll(/```ts\n([\s\S]*?)```/g)].map(match => match[1]);
assert.equal(blocks.length, 17);
assert.equal(readFileSync("lib/contract-draft/index.ts", "utf8").replace(/\r\n/g, "\n").trim(), blocks.join("\n\n").trim());
const body = {error: {code: "internal_error", message: "An unexpected error occurred."}};
c.ApiErrorSchema.parse(body);
c.ApiErrorResponseSchema.parse({status: 500, body});
const names = ["Me", "Onboarding", "GeneratePlan", "ActivePlan", "Sessions", "Gyms", "GymQrToken", "Checkin", "Rewards", "Redeem", "Subscribe", "Nutrition", "PartnerStats"];
assert.equal(Object.keys(c.EndpointContracts).length, 13);
for (const name of names) {
  c[`${name}ErrorSchema`].parse(body);
  c[`${name}ErrorResponseSchema`].parse({status: 500, body});
}
assert.equal(c.InternalErrorSchema.safeParse({error: {...body.error, message: "Private detail"}}).success, false);
console.log("PASS: exact draft copy; all 13 endpoint error unions accept the fixed 500 response");
'@ | node --input-type=module
```

В одном терминале запустить сервер, предварительно задав серверные переменные окружения:

```powershell
pnpm exec next dev --webpack --hostname 127.0.0.1 --port 3100
```

В другом терминале проверить отсутствие сессии:

```powershell
curl.exe -i http://127.0.0.1:3100/api/me
curl.exe -i -X POST http://127.0.0.1:3100/api/onboarding -H 'Content-Type: application/json' --data '{}'
curl.exe -i http://127.0.0.1:3100/api/gyms
curl.exe -i http://127.0.0.1:3100/api/rewards
```

Для следующих запросов самостоятельно задайте `$env:SHOWUP_SESSION_COOKIE` полным заголовком Cookie из действующей Supabase SSR-сессии тестового пользователя; если библиотека разбила cookie, нужны все её части. Следующие команды с действительной сессией здесь **не запускались**:

```powershell
curl.exe -i --cookie "$env:SHOWUP_SESSION_COOKIE" http://127.0.0.1:3100/api/me
$body = @{
  age = 30
  height_cm = 178
  weight_kg = 75
  goal = 'general_fitness'
  workout_types = @('gym_strength')
  session_minutes = 45
  weekdays = @(1, 3, 5)
  equipment = @('full_gym')
  injuries = @()
  timezone = 'America/Chicago'
} | ConvertTo-Json -Depth 5 -Compress
$body | curl.exe -i --cookie "$env:SHOWUP_SESSION_COOKIE" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/onboarding --data-binary '@-'
curl.exe -i --cookie "$env:SHOWUP_SESSION_COOKIE" http://127.0.0.1:3100/api/gyms
curl.exe -i --cookie "$env:SHOWUP_SESSION_COOKIE" http://127.0.0.1:3100/api/rewards
'{"is_pro":true}' | curl.exe -i --cookie "$env:SHOWUP_SESSION_COOKIE" -H 'Content-Type: application/json' -X POST http://127.0.0.1:3100/api/onboarding --data-binary '@-'
```

Ожидаемые статусы: 200 для первых четырёх запросов при готовой БД; 422 для последнего. Сохранённую анкету можно прочитать повторным `/api/me`. `is_pro` в POST не является допустимым полем.

Для БД сначала примените обе миграции обычным способом вашего Supabase-проекта. С уже заданными тремя переменными окружения можно выполнить следующие команды (они изменяют БД; здесь не запускались):

```powershell
node scripts/seed.mjs
node scripts/seed.mjs
node scripts/postgrest-smoke.mjs
```

Seed повторяемый, не печатает qr_secret. Smoke создаёт и удаляет временных пользователей, проверяет прямые права REST/RPC и изоляцию строк; при FAIL возвращает код 1. Он не заменяет проверку cookie-сессии через Next.js API.
