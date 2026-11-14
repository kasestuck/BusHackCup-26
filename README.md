# ShowUp — AI Fitness + Gym Rewards

> You pay for the gym. We make sure you actually go.

Hackathon project for Business Cup 2.0. Full product and technical spec: [docs/SPEC.md](docs/SPEC.md).

## Run locally

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true until the backend is ready
npm run dev                  # http://localhost:3000 (landing) · /dashboard (app)
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

With mocks on, a "Mock data" badge is shown in the header. Preview UI states with
`?mock=rest_day | new_user | no_plan | empty_rewards | pro | error | unauthorized | offline | slow | generate_error | rate_limited | rich`
on any page. The scenario sticks for the browser tab; switching scenario starts clean, and `?mock=reset` clears the mock's saved data.

## Auth

Sign up / log in run in the browser with Supabase (`@supabase/ssr`), email + password or magic link.
The session is stored in cookies, so `/api/**` route handlers can read it.

- Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`.
- In Supabase → Authentication → URL configuration, add `<site>/auth/callback` as a redirect URL
  (magic links and email confirmation land there).
- "Continue without an account" signs in as a guest (Supabase anonymous user, real session).
  Enable it in Supabase → Authentication → Providers → **Anonymous sign-ins**.
- With `NEXT_PUBLIC_USE_MOCKS=true`, auth is mocked: any email/password works, nothing is sent.

## AI Coach (proposal)

`/coach` is a chat with an AI coach. Its endpoint `POST /api/assistant` is a **proposal**, not yet in
`lib/contract`: the schemas live in `lib/client/assistant-contract.ts` and run on mocks until the backend
agrees and implements it (model call via `lib/server/ai.ts`, with the user's plan, coins and streak as context).

## Structure

| Path | Owner |
|---|---|
| `app/(site)/**`, `components/**`, `styles/**`, `lib/client/**`, `public/**` | Frontend |
| `app/api/**`, `lib/server/**`, `supabase/migrations/**`, `scripts/**` | Backend |
| `lib/contract/**` | Shared — changes need both developers |

## Backend

Сервер — Next.js App Router, TypeScript, Zod и Supabase. Требуются Node.js 22.19+ (проверено 24.22.1) и pnpm 11.25.0. Каркас вынесен в отдельный коммит `fbc5138` с сообщением `chore: throwaway scaffold (do not merge)`; backend можно перенести в общий проект отдельно от него.

### Запуск

Переменные задаются в локальном `.env.local` или окружении хостинга. Файл с секретами не коммитится.

| Переменная | Назначение |
|---|---|
| SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL | URL проекта; сервер предпочитает первый вариант |
| SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_ANON_KEY | Публичный ключ для cookie/Bearer Auth; сервер предпочитает первый вариант |
| SUPABASE_SERVICE_ROLE_KEY | Только сервер: административные запросы и RPC записи |
| GYM_ADMIN_KEY | Отдельный случайный ключ QR-экрана, минимум 32 символа |
| AI_API_KEY | Серверный ключ AI; пустое значение включает запасной план |
| AI_BASE_URL | Базовый адрес совместимого AI API |
| AI_MODEL | Имя модели |
| DEMO_EMAIL | Адрес подготовленного демо-аккаунта, только seed-demo |
| DEMO_PASSWORD | Пароль для создаваемых демо-аккаунтов, только seed-demo |
| DEMO2_EMAIL | Адрес второго аккаунта без анкеты, только seed-demo |

Установить зависимости `pnpm install --frozen-lockfile`. Все запуски Node ниже используют `--use-system-ca`: это позволяет применять системное хранилище доверенных сертификатов, в том числе при ошибке сертификата в Node. Проверка TLS остаётся включённой.

Порядок подготовки: **миграции по номерам → seed → ручная проверка видео → seed-demo → dev**. Применённые миграции не запускать повторно. Если 001–005 уже применены, в Supabase SQL Editor выполнить отдельно сначала `006_commerce`, затем `007_demo_seed` из `supabase/migrations` (полные имена приведены в backend-integration.md). Не переносить только новый код без новых миграций. Файлы исполняются как обычный SQL без psql-команд.

Скрипты читают SUPABASE_URL и SUPABASE_ANON_KEY; при NEXT_PUBLIC-именах передать алиасы только в памяти процесса:

```powershell
node --use-system-ca --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const {runSeed}=await import('./scripts/seed.mjs'); await runSeed({argv:['--dry-run']})"
node --use-system-ca --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const {runSeed}=await import('./scripts/seed.mjs'); await runSeed()"
node --use-system-ca --conditions=react-server --env-file=.env.local scripts/seed-demo.mjs --dry-run
node --use-system-ca --conditions=react-server --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const {runDemoSeed}=await import('./scripts/seed-demo.mjs'); await runDemoSeed()"
node --use-system-ca node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3100
```

`seed` создаёт каталог с `verified=false` и пустыми video IDs. До seed-demo люди должны подобрать видео и проверить упражнения; выдуманные IDs недопустимы. При недостаточном проверенном каталоге seed-demo прекращается до создания пользователей. Подробные команды, зависимости и ограничения: [docs/backend-integration.md](docs/backend-integration.md).

### Архитектура и защита

Обработчики `app/api` проверяют запрос и ответ через контракт, доступный серверу только через `lib/server/contract.ts`. Cookie-сессия проверяется Supabase Auth; запасной способ — Bearer JWT. Ошибки имеют форму `{"error":{"code","message"}}`, а неожиданные исключения дают безопасный `internal_error`. Admin-клиент и AI-конфигурация находятся в server-only модулях.

RLS ограничивает пользовательские SELECT собственными строками. Запись ledger, подписок, посещений и продаж доступна серверу. Баланс вычисляется из ledger; атомарные RPC с блокировкой профиля защищают списания от отрицательного баланса и повторных наград. `coin_balance` выполняется с правами вызывающего: запрос чужого user ID возвращает 0, поскольку RLS скрывает чужие строки.

QR-токен — HMAC секрета зала и минутного окна. Проверяются текущее и предыдущее окна; секреты залов не выходят через API. Check-in и +40 записываются одной транзакцией. План генерируется только из проверенного каталога; при сбое AI используется тот же детерминированный генератор, что и в демо-seed. Попытка AI не расходуется при ошибке входа или недоступном каталоге. Общий AI-бюджет — 40 секунд, лимит маршрута — 60 секунд.

### Эндпоинты

| Метод | Путь | Назначение |
|---|---|---|
| GET | /api/me | Профиль, баланс, streak и подписка |
| POST | /api/onboarding | Анкета |
| POST | /api/plan/generate | Генерация плана |
| GET | /api/plan/active | Активный план |
| POST | /api/sessions | Завершённая тренировка |
| GET | /api/gyms | Каталог залов |
| GET | /api/gyms/:id/qr-token | QR-экран: x-gym-key, без пользовательской сессии |
| POST | /api/checkin | Посещение зала |
| GET | /api/rewards | Активные награды |
| POST | /api/rewards/redeem | Покупка награды за коины |
| POST | /api/billing/subscribe | Имитация оплаты Pro |
| POST | /api/nutrition/analyze | Оценка изображения еды, Pro, до 4 МиБ |
| POST | /api/partner/simulate-purchase | Демо-покупка по полученной партнёрской награде |
| GET | /api/partner/stats?partner_id= | Статистика партнёра; доступна любой сессии для демо |

Кроме QR-экрана все маршруты требуют проверенную сессию. Схемы и ошибки описаны в [предложении контракта](docs/contract-proposal.md).

### Known limitations

- Rate limit хранится в памяти процесса и не является общим в serverless.
- QR можно переслать скриншотом в пределах окна примерно 1–2 минуты.
- Оценка калорий по фото приблизительна; проверяется сигнатура файла, а не полное декодирование изображения.
- **Billing is a demo, everything else is live:** подписка имитирует оплату без списания денег; остальные API используют реальные Auth/БД при настроенном окружении. Partner simulate-purchase создаёт явно демонстрационную продажу с корзиной из economy.ts.
- Каталог допускается к генерации только после ручной проверки видео и установки verified=true. Исходный seed этого не делает.
- Формат фактического AI-провайдера требует сверки; локальные HTTP-фейки подтверждают реализацию принятого протокола, а не совместимость провайдера или качество модели.

### Проверки

```powershell
node --use-system-ca node_modules/next/dist/bin/next build --webpack
node --use-system-ca node_modules/typescript/bin/tsc --noEmit --incremental false
node --use-system-ca --test
node --use-system-ca scripts/verification/native-runner.mjs
```

Native-runner поднимает изолированный локальный PostgreSQL и выполняет прежние и добавленные SQL-проверки с реальной конкуренцией. HTTP-тесты используют локальные фейки. Live smoke требует ключей и уже применённых миграций; его результаты нельзя подменять локальными тестами.
