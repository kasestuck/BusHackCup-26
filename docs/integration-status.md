# Интеграция остановлена: несовместимые контракты

Ветка integration пока не готова к production. Работа остановлена по правилу владельца из фазы 4.4. Исходники фронтенда не менялись, расхождения контракта не разрешались молча, main не обновлялся и push не выполнялся. Добор фазы 1 и новый режим фазы 2 остаются незавершёнными: перенесён существующий BACK без этих новых правок.

## Инвентаризация

- Репозиторий: https://github.com/kasestuck/BusHackCup-26.git, remote origin.
- BACK: 9b9aae6; origin/BACK до переноса: 411c60b.
- Фронт: origin/FRONT, d83e28e. Локальный main и origin/main: 411c60b.
- Общий предок BACK/FRONT и BACK/main: 411c60bee368e412c6cd5d59733ca39838581bde.
- app/, components/, lib/, styles/ находятся в корне; src/ не используется.
- Алиас @/* → ./* совместим. allowImportingTsExtensions=true, strict=true, target=ES2017.
- Фронт: npm, package-lock.json; Next 16.4.6, React 19.3.0; cacheComponents=true и CSS loader для Turbopack.
- У фронта уже есть zod, @supabase/ssr 0.12.7, @supabase/supabase-js 2.119.0. server-only отсутствует в package.json. Установка зависимостей остановлена до согласования контракта; пакет и lockfile не менялись.
- Моки включаются только при NEXT_PUBLIC_USE_MOCKS === "true" (lib/client/mocks.ts:31). Отсутствие переменной или значение false означает настоящий API.
- Фронтовый контракт: lib/contract/index.ts. Backend draft: lib/contract-draft/index.ts. Точный diff: contract-integration.diff рядом с этим документом.
- Все 14 запрошенных backend endpoints присутствуют. Дополнительный фронтовый /api/assistant отсутствует в BACK и не входит в запрошенные 14.

Страховочные теги созданы локально: backup-back-pre-merge → 9b9aae6; backup-front-pre-merge → d83e28e; backup-main-pre-merge → 411c60b. Ветки и теги не удалялись, история не переписывалась. Пользовательское незакоммиченное добавление в .gitignore сохранено в stash с сообщением pre-integration: preserve user gitignore change. Локальный scripts/live-check.mjs сохранён; секретный env не включался в stash или коммиты. После смены .gitignore фронта ранее существовавшая .pnpm-store стала видимой как untracked; это локальный кэш, его не добавлять в коммит.

## Перенос коммитов

integration создана от origin/FRONT, поскольку main пока содержит только Initial commit. Единственный конфликт cherry-pick — README.md: весь фронтовый текст сохранён, добавлен только раздел Backend.

| BACK | integration | Назначение |
|---|---|---|
| c6136e2 | e9a743d | Contract draft |
| d5cb70c | a2de895 | Supabase assets and verification |
| 8b386ac | 3ab2f2e | Authenticated backend foundation |
| 77e3dca | 18dc37c | QR error contract |
| a117387 | e7f0c17 | Activity and QR routes |
| 0d73306 | 6f23e30 | AI error contract |
| 2e1a4a0 | 15a808b | AI plans and nutrition |
| f56186a | d5dd7d6 | Generation quota and AI budget |
| 280a1ca | e807ad2 | Commerce contract |
| 9b9aae6 | 292205a | Commerce routes and demo seed |

Пропущены 411c60b Initial commit и fbc5138 chore: throwaway scaffold (do not merge). Иных коммитов, содержащих только каркас, в выбранной цепочке нет. lib/contract-draft перенесён как часть BACK по фазе 3 и оставлен для сравнения; lib/server/contract.ts пока реэкспортирует его. Переход на общий контракт не выполнен.

## Несовместимые расхождения

| Область | Фронт | BACK |
|---|---|---|
| Profile.display_name | string или null | string |
| Profile.age, equipment, timezone | Отсутствуют | Обязательны, age допускает null |
| Идентификаторы | string | UUID |
| Session day_index | integer >=0 | 0…6 |
| Session exercises и sets | Допускают пустые массивы | Минимум один элемент |
| Session reps | integer >=0 | integer >0 |
| Reward partner_id/discount_pct | Nullable независимо от kind | Ненулевые для partner_product, null для pro_month |
| Subscribe is_pro | boolean | literal(true) |
| Redeem result | Допустимы оба результата или ни одного | Ровно один promo_code/pro_until |
| Plan days/exercises и duration | Пустые массивы и свободные integers | Непустые массивы, enum duration, уникальные weekdays |
| Onboarding | Нет проверок уникальности и сочетания none | Строгие проверки массивов и объектов |
| Nutrition/stats/coins | Более свободные числа | Неотрицательные числа, safe integer для счётчиков |
| Неизвестные поля | В основном удаляются Zod | Отклоняются через strict() |

Имена ResponseSchema/SuccessSchema можно сохранить через дополнительные экспорты; это само по себе не блокер. Нельзя потерять используемые фронтом API_ROUTES, HTTP_STATUS, ApiErrorBodySchema и enum-типы. Изменение video на object|null разрешено владельцем отдельно, но не разрешает молча менять перечисленные выше типы и обязательность.

## Для фронтендера

- components/plan/exercise-card.tsx:91 читает exercise.video.youtube_id/title при проверке только open.
- components/workout/exercise-logger.tsx:135 читает те же поля при проверке только showVideo.
- components/plan/exercise-video.tsx:8 принимает обязательные строки; iframe расположен на строке 27.
- lib/client/plan.ts:50–51 вызывает startsWith у video ID.

После согласования nullable video нужно скрывать Watch technique и не создавать ExerciseVideo при video=null. Исправления этих файлов должен сделать фронтендер. Сейчас nullable video и REQUIRE_EXERCISE_VIDEO=false ещё НЕ внесены: работа остановлена на конфликте общего контракта.

## Остальная работа после согласования

- Добавить отсутствующий server-only, сохранив версии фронта и npm lockfile.
- Ввести утверждённый режим без видео и связанные backend-тесты, переключить facade на общий контракт.
- Добавить maxDuration для nutrition/analyze; у plan/generate уже есть 60.
- Адаптировать backend BigInt literal к target=ES2017 и route segment configs к cacheComponents. Это найденные чтением риски, а не результаты запуска tsc/build; конфиги фронта не менять.
- Выполнить install, tsc, build, node tests, native-runner, seed dry-run, доказательство FAIL и живые проверки.
- Только после успешных проверок слить integration в main и выполнить обычный push.

## Реально выполнено

git remote -v, git fetch --all (exit 0, FRONT обновилась 411c60b→d83e28e), git branch -a/-avv, git log --oneline --graph --all -n 40, git merge-base, git ls-tree/git show/git grep; созданы три тега и integration; перенесены десять коммитов. Снимок графа после переноса сохранён в integration-history.txt.

git diff --no-index -- lib/contract/index.ts lib/contract-draft/index.ts дал exit 1: файлы различаются. Финальный diff сохранён дословно с дополнительным --unified=0: без контекстных строк, чтобы маркеры пустого контекста не считались trailing whitespace в файле отчёта. Первоначальный git diff --cached --check отмечал именно эти маркеры; данные контракта не менялись. Сравнение защищённых фронтовых путей, package/lockfile и lib/contract/index.ts с backup-front-pre-merge дало exit 0.

Install, tsc, build, node --test, native-runner, seed dry-run, временная поломка и живые Supabase-проверки в этой integration — НЕ ЗАПУЩЕНО: обязательная остановка по фазе 4.4. Результаты прежних запусков BACK не считаются проверкой integration.

Новых миграций и новых изменений контракта в ходе интеграции нет. 001–007 перенесены из BACK; 001–005 не редактировались. Инструкция хостинга после устранения блокеров: hosting-vercel.md.

## Проверка секретов и сохранности файлов

Повторно выполнен аудит точных непустых значений из .env.local через Node с --use-system-ca. Проверены 198 файлов рабочего дерева и 341 Git blob по всем достижимым refs, включая историю integration, BACK, FRONT и stash. Результат: findings=[], exit 0. Проверялись GYM_ADMIN_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY; непустых AI-переменных нет. Значения не выводились. Из рабочего дерева исключены локальные зависимости и кэши node_modules, .pnpm-store, .next, а также игнорируемый env; это не аудит всех файлов компьютера. Содержимое шаблона .env.example тоже проверено.

git check-ignore .env.local вывел .env.local. git ls-files с фильтром env вывел только .env.example: фронтовый шаблон отслеживается намеренно, секретного .env.local в Git нет. Поэтому буквальное требование «никаких .env» имеет это исключение; фронтовый шаблон не удалялся. .gitignore содержит .env* и исключение !.env.example.

Сравнение всех миграций и scripts/verification/assertions.sql с BACK: exit 0, diff пуст. Прежние SQL-проверки не удалены и не ослаблены, но в integration пока НЕ ИСПОЛНЯЛИСЬ. Числа выполненных дочерних проверок http/activity/plans/ai-nutrition/commerce/seed-demo: НЕ ЗАПУЩЕНО, а не результат PASS. Доказательство видимого FAIL также НЕ ЗАПУЩЕНО из-за остановки по контракту.

git diff --check: exit 0, вывод пуст. Состояние main и origin/main после переноса: 411c60bee368e412c6cd5d59733ca39838581bde; BACK: 9b9aae6133b4ca40a3008aa42a593099d440689f. README менялся только в разделе Backend; перед прежней инструкцией BACK добавлено предупреждение о незавершённой интеграции.

## Сопоставление маршрутов

Все следующие файлы перенесены из BACK; наличие файла не означает прохождение integration-теста:

| Метод | Путь | Статус |
|---|---|---|
| GET | /api/me | Есть |
| POST | /api/onboarding | Есть |
| POST | /api/plan/generate | Есть, новый режим без видео ещё не внесён |
| GET | /api/plan/active | Есть |
| POST | /api/sessions | Есть |
| GET | /api/gyms | Есть, требуется сессия |
| GET | /api/gyms/:id/qr-token | Есть, без сессии, с x-gym-key |
| POST | /api/checkin | Есть |
| GET | /api/rewards | Есть |
| POST | /api/rewards/redeem | Есть |
| POST | /api/billing/subscribe | Есть |
| POST | /api/nutrition/analyze | Есть, maxDuration ещё не добавлен |
| GET | /api/partner/stats | Есть |
| POST | /api/partner/simulate-purchase | Есть |

## Полный список перенесённых файлов

Сравнение с backup-front-pre-merge перед коммитом отчёта:

```text
M	README.md
A	app/api/billing/subscribe/route.ts
A	app/api/checkin/route.ts
A	app/api/gyms/[id]/qr-token/route.ts
A	app/api/gyms/route.ts
A	app/api/me/route.ts
A	app/api/nutrition/analyze/route.ts
A	app/api/onboarding/route.ts
A	app/api/partner/simulate-purchase/route.ts
A	app/api/partner/stats/route.ts
A	app/api/plan/active/route.ts
A	app/api/plan/generate/route.ts
A	app/api/rewards/redeem/route.ts
A	app/api/rewards/route.ts
A	app/api/sessions/route.ts
A	docs/backend-integration.md
A	docs/contract-proposal.md
A	lib/contract-draft/index.ts
A	lib/server/activity.test.ts
A	lib/server/ai-nutrition.test.ts
A	lib/server/ai.ts
A	lib/server/commerce.test.ts
A	lib/server/commerce.ts
A	lib/server/contract.ts
A	lib/server/data.ts
A	lib/server/economy.test.ts
A	lib/server/economy.ts
A	lib/server/http.test.ts
A	lib/server/http.ts
A	lib/server/nutrition.ts
A	lib/server/plans.test.ts
A	lib/server/plans.ts
A	lib/server/qr.test.ts
A	lib/server/qr.ts
A	lib/server/rate-limit.test.ts
A	lib/server/rate-limit.ts
A	lib/server/session-validation.test.ts
A	lib/server/session-validation.ts
A	lib/server/streak.test.ts
A	lib/server/streak.ts
A	lib/server/supabase.ts
A	lib/server/time.test.ts
A	lib/server/time.ts
A	scripts/exercises.seed.json
A	scripts/postgrest-smoke.mjs
A	scripts/seed-demo.mjs
A	scripts/seed-demo.test.mjs
A	scripts/seed.mjs
A	scripts/validate-exercise-videos.mjs
A	scripts/verification/.gitignore
A	scripts/verification/README.md
A	scripts/verification/assertions.sql
A	scripts/verification/concurrency.mjs
A	scripts/verification/native-runner.mjs
A	scripts/verification/package.json
A	scripts/verification/pnpm-lock.yaml
A	scripts/verification/verify-contract.mjs
A	scripts/verification/verify.mjs
A	supabase/migrations/202611140001_initial_schema.sql
A	supabase/migrations/202611140002_profile_bootstrap_and_permissions.sql
A	supabase/migrations/202611140003_activity_rewards.sql
A	supabase/migrations/202611140004_ai_generation.sql
A	supabase/migrations/202611140005_unmetered_fallback.sql
A	supabase/migrations/202611140006_commerce.sql
A	supabase/migrations/202611140007_demo_seed.sql
```

Дополнительно созданы docs/contract-integration.diff, docs/integration-history.txt, docs/integration-status.md и docs/hosting-vercel.md; добавлено предупреждение в разделе Backend README.md. Самостоятельных правок фронта или других запрещённых файлов нет. lib/contract-draft/index.ts перенесён неизменным из BACK для обязательного сравнения по фазам 3–4; его перенос в lib/contract не выполнялся.
