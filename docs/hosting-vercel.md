# Хостинг после согласования интеграции

Текущая integration заблокирована несовместимыми контрактами и не готова к деплою. Сначала согласовать расхождения из integration-status.md, исправить nullable video на фронте, завершить backend-адаптацию и проверки. Не публиковать текущий main: в нём пока только Initial commit.

## Vercel: по шагам

1. После готовности main: Add New → Project → Import Git Repository → kasestuck/BusHackCup-26. Framework Preset: Next.js. Root Directory: корень репозитория (пустое поле, эквивалент .). Production Branch: main. Install Command: npm ci. Node.js: 24.x, если доступен в настройках проекта. Build Command: npm run build; сейчас фронтовый скрипт вызывает next build и использует Turbopack. Не выбирать --webpack вслепую: у фронта CSS loader задан в turbopack.rules. Итоговый bundler должен быть подтверждён успешной интеграционной сборкой. Output Directory оставить автоматическим для Next.js. [Настройки сборки Vercel](https://vercel.com/docs/builds/configure-a-build).

2. Добавить переменные для Production и, при необходимости, Preview. Секреты вводятся только в Vercel, не в Git. После любого изменения переменных выполнить Redeploy: изменения действуют для нового deployment. [Переменные Vercel](https://vercel.com/docs/environment-variables).

| Имя | Откуда взять |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Supabase: Project URL в настройках API/Connect |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Supabase: legacy anon key, соответствует текущим настройкам проекта |
| SUPABASE_SERVICE_ROLE_KEY | Supabase: service_role key; только серверная переменная |
| GYM_ADMIN_KEY | Отдельная случайная строка минимум 32 символа из менеджера паролей |
| AI_API_KEY | Ключ выбранного AI-провайдера; можно оставить пустым |
| AI_BASE_URL | Базовый адрес API из документации провайдера |
| AI_MODEL | Имя доступной модели из документации провайдера; при выключенном AI можно оставить пустым |
| NEXT_PUBLIC_USE_MOCKS | Удалить либо установить ровно false; true включает моки |

При пустом AI_API_KEY после завершения режима без видео план должен строиться запасным алгоритмом без расхода попытки. Сейчас этот новый режим ещё не реализован. При отключённых моках фронтовый Coach обращается к отсутствующему /api/assistant и получает 404: это отдельная несогласованная функция, не часть текущих 14 endpoints.

3. После получения домена deployment в Supabase Authentication → URL Configuration задать Site URL равным HTTPS origin Vercel. Redirect URLs: добавить точный адрес того же сайта с путём /auth/callback. Для production использовать точный адрес, не произвольный wildcard. В настройках Email Auth выключить Confirm email по решению владельца. Для кнопки Continue without an account отдельно включить Anonymous sign-ins, если нужен этот путь. [Redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls), [Email/password Auth](https://supabase.com/docs/guides/auth/passwords).

4. В этом этапе новых миграций не создано. Уже применённые 001–005 не запускать повторно. Если 006–007 ещё не применены, выполнить в SQL Editor отдельно сначала 202611140006_commerce.sql, затем 202611140007_demo_seed.sql. Проверить текущий список перед публикацией: режим без видео может потребовать новых миграций после согласования. Обновление кэша схемы:

```sql
NOTIFY pgrst, 'reload schema';
```

Каталог для общей dev/production базы заполняется существующим seed; seed-demo для production не запускать. Эти команды здесь не выполнялись:

```powershell
node --use-system-ca --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const {runSeed}=await import('./scripts/seed.mjs'); await runSeed({argv:['--dry-run']})"
node --use-system-ca --env-file=.env.local --input-type=module -e "process.env.SUPABASE_URL=process.env.NEXT_PUBLIC_SUPABASE_URL; const {runSeed}=await import('./scripts/seed.mjs'); await runSeed()"
```

5. После деплоя задать SITE_URL доменом сайта, GYM_ID идентификатором seeded-зала. TEST_USER_JWT должен поступать из сессии тестового пользователя; не выводить его. Проверки:

```powershell
curl.exe -i "$env:SITE_URL/api/me"
curl.exe -i "$env:SITE_URL/api/gyms/$env:GYM_ID/qr-token"
curl.exe -i "$env:SITE_URL/api/gyms" -H "Authorization: Bearer $env:TEST_USER_JWT"
```

Ожидается соответственно 401, 401 и 200 со списком залов без qr_secret. Без сессии /api/gyms также возвращает 401. Успешный QR-token ответ не печатать: он содержит QR-токен. В браузере пройти регистрацию → анкету → план без видео → check-in → журнал тренировок → обмен при достаточном балансе. Проверить отсутствие Mock data и отсутствие видеоплеера при video=null. Для QR/check-in нужен экран зала с секретным gym key, который не публикуется в клиентском коде или Git.

6. Ограничения тарифа и режима исполнения **сверить с документацией Vercel**. Проверить допустимую duration для выбранного тарифа и значение maxDuration в собранных функциях plan/generate и nutrition/analyze. У plan/generate в BACK указано 60; nutrition пока требует добавления настройки. Для лимита фото 4 МиБ учитывать весь multipart-body и служебную оболочку при сравнении с ограничением платформы; проверить граничные запросы после деплоя. Числа лимитов Vercel здесь не утверждаются. [Duration](https://vercel.com/docs/functions/configuring-functions/duration), [Function limits](https://vercel.com/docs/functions/limitations).

7. Для питча: rate limit хранится в памяти процесса и не является общим для нескольких serverless-инстансов; QR можно переслать скриншотом в течение окна примерно 1–2 минуты; оплата Pro имитируется, а пользовательские данные и транзакции остальных реализованных API хранятся в Supabase. Оценка питания по фото приблизительна.

## Команды после устранения блокеров

Ниже план проверки, а не уже выполненные команды integration. NODE_OPTIONS передаёт флаг системного CA дочерним Node-процессам npm.

```powershell
$env:NODE_OPTIONS='--use-system-ca'
npm ci
npm run typecheck
npm run build
node --use-system-ca --test
node --use-system-ca scripts/verification/native-runner.mjs
node --use-system-ca scripts/seed.mjs --dry-run
```

Проверочный пакет scripts/verification имеет собственный lockfile и зависимости; при их отсутствии выполнить pnpm --dir scripts/verification install --frozen-lockfile. Это не смена менеджера фронтенда. Перед npm ci следует добавить недостающий server-only версии 0.0.1 в разрешённые package.json/package-lock.json без обновления существующих пакетов.

Только когда проверки пройдут и contract/null-video блокеры будут сняты:

```powershell
git switch main
git merge --ff-only integration
git push origin integration
git push origin main
```

Если fast-forward стал невозможен из-за новых коммитов main, проверить расхождение и использовать обычный git merge integration, без force. Сейчас эти команды выполнять рано. Существующий main и удалённые ветки этим этапом не изменены.
