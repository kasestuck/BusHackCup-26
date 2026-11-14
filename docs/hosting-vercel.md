# ShowUp: публикация на Vercel

Текущая версия проверена локальной production-сборкой, TypeScript, клиентскими/серверными тестами и native-runner. План и AI Coach проверены живыми запросами к Meta; в общей базе Supabase уже одобрены все 55 видео. Пользователь разрешил публикацию этой версии. Состояние доступа к Vercel и фактический URL deployment указываются в итоговом отчёте, а не предполагаются по успешной локальной сборке.

## Настройки проекта

1. Войти в Vercel, выбрать Add New → Project → Import Git Repository → `kasestuck/BusHackCup-26`.
2. Production Branch: `main`. Framework Preset: `Next.js`. Root Directory: корень (`.`). Install Command: `npm ci`. Build Command: `npm run build`. Output Directory: автоматический. Node.js: `26.x`, соответствующий проверенной локальной основной версии. Текущая сборка использует Turbopack и проходит: не переключать её на webpack, поскольку фронт настраивает Tailwind через turbopack.rules.
3. Для функций задать default Max Duration `60` секунд, если это разрешено выбранным тарифом. У plan/generate и assistant в коде maxDuration=60; nutrition использует default проекта. Доступность значения и действующие ограничения сверить с [документацией duration](https://vercel.com/docs/functions/configuring-functions/duration), [версиями Node.js](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) и [настройками сборки](https://vercel.com/docs/builds/configure-a-build).
4. Добавить окружение до первого deployment. Если deployment уже был выполнен, после изменения переменных нужен Redeploy.

## Окружение

Значения секретов не входят в Git и этот документ. Для Production перенести значения из локального .env.local в защищённые настройки Vercel. Preview настраивать отдельно, только если нужен доступ к той же базе.

| Переменная | Где взять значение |
|---|---|
| NEXT_PUBLIC_SUPABASE_URL | Project URL текущего проекта Supabase |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | Текущий Supabase anon key из API settings |
| SUPABASE_SERVICE_ROLE_KEY | Текущий Supabase service_role key; только сервер |
| GYM_ADMIN_KEY | Существующая отдельная длинная случайная строка из локального окружения |
| AI_API_KEY | Текущий ключ Meta из dev.meta.ai/api-keys; только сервер |
| AI_BASE_URL | Базовый адрес официального Meta Model API из его документации, без /chat/completions |
| AI_MODEL | Точное имя модели из текущего рабочего локального окружения |
| NEXT_PUBLIC_USE_MOCKS | Удалить или установить строго `false`; только `true` включает моки |

Сервер добавляет /chat/completions к AI_BASE_URL сам. При пустых AI-настройках план использует детерминированный запасной алгоритм, но ему всё равно нужен проверенный каталог. Coach без настроенного AI возвращает 503. Образец протокола: [Meta Chat Completions](https://dev.meta.ai/docs/protocols/chat-completions). Правила окружения: [Vercel environment variables](https://vercel.com/docs/environment-variables).

## Supabase

1. В Authentication → URL Configuration поставить Site URL равным HTTPS origin готового сайта Vercel.
2. В Redirect URLs добавить тот же origin с `/auth/callback`. Не использовать широкий wildcard для production. [Документация Supabase](https://supabase.com/docs/guides/auth/redirect-urls).
3. Confirm email выключить по решению владельца; для Continue without an account нужен Anonymous sign-ins. Не проверять массовую email-регистрацию: для живых тестов использовался временный подтверждённый пользователь через admin API.
4. В этом выпуске новых миграций нет. Уже применённые файлы повторно не запускать. Для новой базы применить 001–007 по порядку; для существующей проверить, что 006_commerce и 007_demo_seed уже установлены. Обновление PostgREST при необходимости:

```sql
NOTIFY pgrst, 'reload schema';
```

5. Dev и production используют одну базу: 55 одобренных видео уже в ней, повторный seed для публикации не требуется. Не запускать seed-demo на production. Базовый seed хранит video=null/verified=false и намеренно сохраняет существующие video-поля при upsert. Список одобренных ссылок — scripts/exercise-videos.review.csv и docs/exercise-videos.candidates.json. Эти файлы сами по себе не загружаются в БД при сборке.

## Проверка после deployment

В PowerShell задать SITE_URL публичным origin сайта и GYM_ID публичным идентификатором зала, затем:

```powershell
curl.exe -i "$env:SITE_URL/api/me"
curl.exe -i "$env:SITE_URL/api/gyms"
curl.exe -i "$env:SITE_URL/api/gyms/$env:GYM_ID/qr-token"
```

Все три запроса без сессии/ключа должны вернуть 401. /api/gyms с пользовательской сессией возвращает 200 и не содержит qr_secret. Успешные ответы qr-token не выводить в общие логи.

В браузере: регистрация/вход → анкета → генерация плана → просмотр настоящего видео → AI Coach → check-in по актуальному QR → запись тренировки → обмен при достаточном балансе. Убедиться, что Mock data не показан. Не публиковать GYM_ADMIN_KEY в браузерном коде; QR-экран должен получать его только предусмотренным административным способом.

## Проверки и ограничения

Локально выполнены с --use-system-ca: npm install (up to date), tsc (exit 0), next build (43/43, exit 0), 83 верхнеуровневых Node-теста (0 FAIL), дочерние HTTP/AI проверки (8+10+17+10+10+11, все PASS), native-runner (216 SQL PASS). Подробности и исторические этапы — integration-status.md. Фронтенд и его конфиги не менялись.

Сверить с [лимитами Vercel](https://vercel.com/docs/functions/limitations) таймаут и максимальное тело запроса конкретного тарифа. Сервер принимает изображения до 4 МиБ; учитывать весь multipart-body, а не только файл. Фронт пока разрешает выбрать до 20 МБ, поэтому сервер отклонит превышение 422; это известное несогласование, фронт не изменён. Nutrition с настоящим Meta отдельно не проверялся.

Rate limit хранится в памяти отдельного процесса и не общий для serverless-инстансов. QR можно переслать скриншотом в пределах временного окна. Оплата Pro имитируется; Auth, база, коиновая экономика, генерация плана и Coach работают с реальными сервисами. Контрактный facade пока использует draft-схемы и общий assistant; объединение контрактов остаётся отдельной задачей.
