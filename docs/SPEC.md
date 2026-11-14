# Hackathon Spec: AI Fitness + Gym Rewards (US, 25–45)

> Source: "Hackathon Spec AI Fitness + Gym Rewards (US, 25–45).pdf" (18 pages), Nov 14, 2026 · @Tatyana.
> This file is a faithful English rendering of that PDF for both AI agents (Claude Code — frontend, Codex — backend).
> All numbers, field names, endpoints, error codes and rules are copied as written. Nothing was added; where the
> original is ambiguous it is listed under **Open questions** at the end, not resolved here.

---

## 1. Overview

We are building a web app that uses AI to create a workout plan for a busy person aged 25–45 in the US, and pays them
coins for real visits to a partner gym.

- **Product name: ShowUp.** The name reflects the main pain and the main action: just show up.
  Backup names: StreakFit, RepsPay, GymLoop. Domain and trademark availability were not checked; fine for a hackathon.
- The in-app currency is called **"coins"**.
- **User:** a professional aged 25–45 in the US who pays for a gym membership but goes irregularly.
- **Pain:** no time to think about what to do at the gym, and no reason to go *today*.
- **Solution:** an AI plan that fits the available time and equipment, plus a reward for every verified visit.
- **One-line pitch:** "You pay for the gym. We make sure you actually go."
- **How we make money:** Pro subscription (nutrition analysis and extended features) and commission from
  sports-nutrition partners.
- **Track:** Skills (people can't master a skill and don't follow through on a habit). Confirm with organizers that
  the track fits.
- **UI language and currency:** English, USD.
- **Deadline:** 24 hours.

## 2. Judging (Business Cup 2.0)

| Criterion | Weight | What we show the jury |
|---|---|---|
| Does it work? (product and engineering) | 40% | A working path from sign-up to redeeming coins in production, no mockups or hardcode. The repository is read. |
| What do we sell? | 20% | It is clear what the user pays for and why they will come back tomorrow. |
| Who do we sell to? | 15% | One audience and one pain: 25–45, US, pays for the gym but rarely goes. |
| Why does it make money? | 15% | Subscription + partner commission. We compute LTV > CAC. |
| Is it new? | 10% | Not a copy of an existing business. The chain "gym visit → coins → subscription or partner product" is not found anywhere. |

### Pass / fail rules

- B2C only, no B2B. Partners (gyms and sports nutrition) are presented as a channel and commission source, not as a
  separate product for businesses.
- Web only, no mobile apps. Responsive layout for phones.
- All 3 submission items must be delivered. Open question: what exactly the 3 items are (check the rules).

## 3. Scope: what we build in 24 hours

The MVP includes only the functions without which the user cannot complete the path from sign-up to redeeming coins;
everything else goes on the "what's next" slide.

| # | Feature | Priority | Owner |
|---|---|---|---|
| 1 | Sign-up and sign-in (email + password or magic link) | P0 | backend + frontend |
| 2 | Onboarding questionnaire: height, weight, injuries, goal, workout type, time, weekdays | P0 | frontend |
| 3 | AI generates a day-by-day program with exercises and a technique video for each | P0 | backend |
| 4 | Program view: week calendar, exercise card with embedded video | P0 | frontend |
| 5 | Workout log (sets, reps, weight) and awarding XP and coins | P0 | backend + frontend |
| 6 | Partner-gym check-in via QR, coins and streak | P0 | backend + frontend |
| 7 | Coin store: a month of Pro or a partner promo code | P0 | backend + frontend |
| 8 | Pro subscription with simulated payment and paywall | P0 | backend + frontend |
| 9 | Nutrition analysis from a photo, Pro only | P1 | backend + frontend |
| 10 | Partner panel: sales and commission | P1 | backend + frontend |
| 11 | Regenerate the program after changing the questionnaire; replace a single exercise | P2 | backend + frontend |

**Not doing:** native mobile apps, real integrations with gym systems, social feed, chat with a coach, real payments
(payment is only simulated).

## 4. Architecture and stack

One Next.js repository, one Vercel deployment; front and back share folders and the API contract, so they can work in
parallel without blocking each other.

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js (App Router), TypeScript, Tailwind CSS | Fast UI, phone-responsive |
| Backend | Next.js Route Handlers (`app/api/**`), Node runtime | One deploy, no separate server |
| Database and auth | Supabase (Postgres, Auth, Storage, RLS) | Free tier, ready-made auth |
| AI | Muse Spark 1.3 via Meta Model API (model ID `muse-spark-1.3`; server-side call, the key never reaches the browser) | Workout plan and food-photo analysis |
| Payments | Simulated: a checkout screen without a payment provider, but the Pro status is really stored in the DB | Pro subscription |
| Technique videos | Embedded YouTube videos (`youtube-nocookie.com/embed`) | Technique for every exercise |
| Hosting | Vercel + GitHub | Deploy on push |

### Folder ownership (to avoid git conflicts)

- **Frontend (Claude Code):** `app/(site)/**`, `components/**`, `styles/**`, `lib/client/**`, `public/**`.
- **Backend (Codex):** `app/api/**`, `lib/server/**`, `supabase/migrations/**`, `scripts/**` (seed).
- **Shared (changed only by agreement of both):** `lib/contract/**` (TypeScript types and zod schemas of all API
  requests and responses).

**Parallel-work rule:** in the first hour both developers fix `lib/contract`. Until the backend is ready, the front
works on mocks (`NEXT_PUBLIC_USE_MOCKS=true`) that return data in the same shape. When an endpoint is ready, its mock is
switched off.

Architecture: 2 developers, 3 external services. The front talks **only** to `/api/**`; AI and DB keys live only on
the server, and the browser loads videos directly from YouTube.

## 5. Data model

Postgres in Supabase, 13 tables. The coin balance is **not** stored as a separate field; it is computed as the sum of
the `coin_ledger` journal so it cannot get out of sync. All tables with user data are protected by RLS: a user can only
read and write their own rows.

| Table | Key fields | Notes |
|---|---|---|
| `profiles` | `id` (= auth user id), `display_name`, `height_cm`, `weight_kg`, `goal`, `workout_types` (text[]), `session_minutes`, `weekdays` (int[], 1–7), `injuries` (jsonb), `home_gym_id`, `is_pro` | UI shows height in ft/in, weight in lb; the DB stores metric |
| `exercises` | `id`, `slug`, `name`, `muscle_group`, `equipment`, `contraindicated_for` (text[]), `video_youtube_id`, `video_title`, `verified` | Exercise catalog with verified videos (see AI section) |
| `workout_plans` | `id`, `user_id`, `created_at`, `active`, `input_snapshot` (jsonb), `plan_json` (jsonb) | `plan_json` stores days and exercises referencing `exercises.slug` |
| `workout_sessions` | `id`, `user_id`, `plan_id`, `day_index`, `completed_at`, `log_json`, `xp` | Log of a completed workout |
| `gyms` | `id`, `name`, `city`, `address`, `qr_secret`, `partner_id` | Demo: 2–3 fictional gyms |
| `gym_checkins` | `id`, `user_id`, `gym_id`, `checked_in_at`, `local_date` | `unique(user_id, local_date)` forbids two check-ins per day |
| `coin_ledger` | `id`, `user_id`, `amount`, `reason`, `ref_id`, `created_at` | Balance = `sum(amount)` |
| `partners` | `id`, `name`, `type` (`gym` \| `supplements`), `commission_pct`, `ref_slug` | Gym and sports-nutrition partners |
| `rewards` | `id`, `kind` (`pro_month` \| `partner_product`), `title`, `partner_id`, `cost_coins`, `discount_pct`, `active` | What can be bought with coins |
| `redemptions` | `id`, `user_id`, `reward_id`, `coins_spent`, `promo_code`, `created_at` | Coin debit + issuing a promo code or Pro |
| `subscriptions` | `user_id`, `plan`, `source`, `status`, `current_period_end` | Updated only by the server: on simulated payment or coin redemption |
| `partner_sales` | `id`, `partner_id`, `redemption_id`, `amount_cents`, `commission_cents`, `created_at` | For the partner panel |
| `food_logs` | `id`, `user_id`, `image_path`, `result_json`, `created_at` | Nutrition analysis, Pro only |

### User questionnaire (input data for AI)

| Field | UI type | Values |
|---|---|---|
| Height | number | ft/in in UI, `height_cm` in DB |
| Weight | number | lb in UI, `weight_kg` in DB |
| Injuries | list (may be empty) | Each injury: `area` (`knee`, `lower back`, `shoulder`, `wrist`, `ankle`, `other`), `when` (approximate: month and year, or "N years ago"), `status` (`recovered` \| `ongoing`) |
| Goal | single choice | `lose_fat`, `build_muscle`, `get_stronger`, `general_fitness`, `endurance` |
| Workout type | multi-choice | `gym_strength`, `home_bodyweight`, `cardio_hiit`, `mobility_yoga` |
| Time per workout | choice | 20, 30, 45, 60, 75 minutes |
| Weekdays | multi-choice of 7 | `weekdays` array; workouts per week = array length, no separate "how many times" field |
| Equipment *(added by us)* | multi-choice | `full_gym`, `dumbbells`, `bands`, `none`; needed so the AI never assigns unavailable equipment |
| Age *(added by us)* | number 18–70 | Needed for the plan; target audience is 25–45 |

## 6. API contract

Front and back talk only through these 13 JSON endpoints; response types must be duplicated in `lib/contract` as zod
schemas. Authorization on all endpoints except public ones is via the Supabase session (cookie).

| Method and path | Request | Response | Notes |
|---|---|---|---|
| `GET /api/me` | — | `{profile, coins_balance, streak, is_pro, has_plan}` | Current user state |
| `POST /api/onboarding` | Questionnaire (see "Data model") | `{profile}` | Saves the questionnaire |
| `POST /api/plan/generate` | `{}` (takes the questionnaire from the profile) | `{plan}` (shape in the AI section) | 5–15 seconds, the front shows a loading state |
| `GET /api/plan/active` | — | `{plan}` or 404 | Videos are already attached to every exercise |
| `POST /api/sessions` | `{plan_id, day_index, exercises: [{slug, sets: [{reps, weight_kg}]}]}` | `{xp_earned, coins_earned, balance}` | Completing a workout |
| `GET /api/gyms` | — | `{gyms: [{id, name, city, address}]}` | List of partner gyms |
| `GET /api/gyms/:id/qr-token` | header `x-gym-key` | `{token, expires_in}` | For the gym screen with a rotating QR |
| `POST /api/checkin` | `{gym_id, token}` | `{coins_earned, streak, balance}` or 409 `already_checked_in` | Once per day |
| `GET /api/rewards` | — | `{rewards: […]}` | Coin store |
| `POST /api/rewards/redeem` | `{reward_id}` | `{promo_code?, pro_until?, balance}` or 402 `not_enough_coins` | Debits coins in a transaction |
| `POST /api/billing/subscribe` | `{plan: "pro_monthly"}` | `{is_pro, pro_until}` | Simulated payment: the server sets `is_pro` without a payment provider |
| `POST /api/nutrition/analyze` | multipart, field `image` | `{items: […], totals}` or 402 `pro_required` | Pro only |
| `GET /api/partner/stats?partner_id=` | — | `{sales_count, revenue_cents, commission_cents}` | Partner panel (demo) |

**Error format:**

```json
{"error": {"code": "not_enough_coins", "message": "You need 400 more coins."}}
```

**HTTP codes:** 401 no session · 402 Pro required or not enough coins · 409 repeated check-in · 422 invalid data ·
429 too many AI requests.

## 7. Business logic

Coins are awarded only for verified actions and spent on a month of Pro or a partner promo code. The numbers below are
working assumptions; they can be changed in one place (`lib/server/economy.ts`).

### Earning coins

| Action | Coins | Rule |
|---|---|---|
| First AI plan | 20 | Once |
| Completed workout in the log | 10 | At most one per day |
| Partner-gym QR check-in | 40 | At most one per day |
| Week bonus | 50 | All planned days of the week completed (`weekdays` from the questionnaire) |

Example month of a disciplined user (3 visits a week): about 13 visits × 50 + 4 × 50 bonus ≈ 850 coins.

### Coin store

| Reward | Price in coins | What the user gets |
|---|---|---|
| Month of Pro | 1200 | `pro_until` is extended by 30 days |
| 15% off a sports-nutrition partner product | 500 | Unique promo code |
| 25% off a partner product | 900 | Unique promo code |

A month of Pro takes about a month and a half of regular training. This is good for us: free Pro only costs AI calls,
and by then the person has built the habit and is likely to stay on the paid plan.

### Free and Pro

| Feature | Free | Pro |
|---|---|---|
| AI plan with videos | yes, 1 generation per week | unlimited |
| Log, coins, gym check-ins | yes | yes |
| Nutrition analysis from a photo | no | yes |
| Extended statistics | no | yes |

**Pro price on screen: $12.99 per month** (assumption, close to typical US fitness-app prices).

### Payment (simulated)

No real charges: the `/checkout` screen shows a card form with the banner **"Demo mode: no real charge"**, accepts any
data, and calls `POST /api/billing/subscribe`. The server sets `is_pro = true`, `pro_until = now + 30 days` and writes a
row into `subscriptions` with `source = mock_payment`. The Pro status is then really stored in the DB and really unlocks
features — only the payment itself is simulated. In the pitch we say it directly: **"billing is a demo, everything else
is live"**.

### Partner commission

A sports-nutrition partner pays us a percentage of sales made with our promo code. In the demo `commission_pct = 15`
(assumption; check against real affiliate programs before the pitch). A purchase from the partner is simulated in the
demo with a **"Use code at partner store"** button: the server creates a `partner_sales` row with an amount and
`commission_cents = amount_cents × commission_pct / 100`, and the partner panel shows accumulated commission.

### Anti-abuse for coins

- The gym QR token rotates every 60 seconds: `HMAC_SHA256(gym.qr_secret, floor(unix_time / 60))`. The server accepts
  the current and the previous window so a scan at the minute boundary does not fail.
- One check-in per user per day is enforced by `unique(user_id, local_date)` in the DB, not only in code.
- Debiting coins and issuing a reward happen in one transaction; the balance cannot go negative.
- Per-user rate limit on `/api/checkin` and `/api/plan/generate`.
- Optional (P2): geolocation check within 300 m of the gym.

## 8. AI: workout plan, videos and nutrition analysis

Muse Spark 1.3 makes the plan, but the server takes exercise videos from our own catalog, because the model can invent
a link that does not open.

### Model connection

- **Model:** Muse Spark 1.3 by Meta, model ID `muse-spark-1.3`. According to public sources it accepts text and images
  and supports structured outputs, so it fits both the plan and food-photo analysis.
- **Access:** Meta Model API (`dev.meta.ai`) or routers such as OpenRouter and Vercel AI Gateway (ID
  `meta/muse-spark-1.3`). In the first hour, check that the key actually works from your region; if not, use OpenRouter.
- The backend takes exact URLs and request format from the provider's official docs; in code there is one file
  `lib/server/ai.ts` with a function `generateJson(schema, messages, images?)` so the model can be swapped in a minute.
- **Reasoning:** for this model `reasoning_effort: "none"` returns a 400 error; use `low` or `medium`. `low` is enough
  for the plan — faster and cheaper.
- **Price:** about $1.25 per 1M input and $4.25 per 1M output tokens per public data; one plan costs pennies. Re-check
  the current price before the pitch.

### How the plan is generated

1. The server reads the questionnaire from `profiles`.
2. The server filters the `exercises` catalog by equipment and injuries: if the user has an injury in area X with
   status `ongoing`, exercises with X in `contraindicated_for` are removed from the list **before** calling the model.
   This is more reliable than asking the model to "be careful". For `recovered` injuries the model simply receives the
   date and area and picks gentle variations.
3. The server sends the model the questionnaire and the list of allowed `slug`s. The model must pick exercises only
   from this list.
4. The server validates the answer with a zod schema. On error — one retry with the error text. If it fails again or
   the API does not respond, a fallback template plan for the same days and time is returned so the demo does not
   break on a network failure.
5. The server attaches `name` and `video_youtube_id` by `slug`, saves the plan to `workout_plans` and returns it to the
   front.

### Technique videos

- Catalog: about 50–60 basic exercises (squats, presses, rows, push-ups, planks, lunges, stretching). For each one we
  manually find a YouTube video from a reasonable author and put its ID in `scripts/exercises.seed.json`. Every video
  must actually be opened and checked that embedding is enabled; IDs must never be requested from the model.
- In the browser the video is embedded with
  `<iframe src="https://www.youtube-nocookie.com/embed/{id}" loading="lazy" allowfullscreen>`, **no autoplay**.
- Under the player there is a **"Watch on YouTube"** link in case the video does not load.
- If the model returns a `slug` not in the catalog, the server replaces it with a similar exercise from the same muscle
  group or removes it.
- P2 if time allows: search videos via YouTube Data API for exercises outside the catalog, cached in `exercises`.

### Plan shape returned by the API (`plan`)

```json
{
  "id": "<plan uuid>",
  "title": "Strength Foundations",
  "summary": "3 days a week, 45 minutes, full gym",
  "days": [
    {
      "weekday": 1,
      "focus": "Lower body",
      "duration_min": 45,
      "exercises": [
        {
          "slug": "goblet-squat",
          "name": "Goblet Squat",
          "sets": 3,
          "reps": "8-10",
          "rest_sec": 90,
          "note": "Keep your chest up and knees tracking over toes.",
          "video": { "youtube_id": "<id from catalog>", "title": "<title from catalog>" }
        }
      ]
    }
  ],
  "safety_note": "This plan is general fitness guidance, not medical advice."
}
```

The model returns the same without `name` and `video` (the server attaches them). `weekday` is the weekday number 1–7,
exactly one day for each weekday selected in the questionnaire.

### Plan prompt (draft, backend refines)

```
You are a certified-strength-coach style assistant. Create a weekly workout plan as JSON only.
Rules:
- Use ONLY exercise slugs from the provided allowed_exercises list. Never invent slugs or URLs.
- Create exactly one training day for each weekday in user.weekdays.
- Fit each day to user.session_minutes: 20 min = 3-4 exercises, 30 = 4-5, 45 = 5-6, 60 = 6-8, 75 = 7-9.
- Match the plan to user.goal and user.workout_types, and only use equipment the user has.
- Respect user.injuries: for recovered injuries prefer gentle variations; never include movements that load an ongoing injury.
- Beginner-friendly sets, reps and rest unless user.level says otherwise. Add a short coaching note per exercise.
- Do not give medical advice. If an injury is ongoing, add a sentence in safety_note suggesting to consult a doctor.
Return JSON that matches the provided schema. No text outside JSON.
```

### Nutrition analysis from a photo (Pro, P1)

The photo goes to the model as an image; the answer is JSON: `items` (`name`, `grams_estimate`, `kcal`, `protein_g`,
`carbs_g`, `fat_g`), `totals`, `confidence` (`low` | `medium` | `high`) and `disclaimer`. The front shows the numbers as
an estimate ("approximate estimate"), not as an exact calculation. The server checks `is_pro` before calling the model
and responds 402 `pro_required` if not.

## 9. Constraints and security

- The model key is stored only in server environment variables, never in `NEXT_PUBLIC_*` and never in git.
- Health data (injuries, weight) is readable only by its owner (RLS). The site needs a **Privacy** page and a
  **"not medical advice"** disclaimer.
- Limits: Free — 1 plan generation per week; Pro — up to 10 per day.

## 10. Tasks by hours: front and back

Work is split into two lanes; the first and last hours are done together: at the start we fix the contract, at the
end we run the whole user path on the real site.

| Hours | Front (Claude Code) | Back (Codex) |
|---|---|---|
| 0–1 | **Together:** fix `lib/contract`, create the repo, deploy an empty skeleton to Vercel, Supabase project, check the Muse Spark key | (same) |
| 1–4 | UI skeleton: colors, fonts, navigation, mobile layout, sign-in and sign-up pages, API mocks | Postgres schema, RLS, migrations, seed: gyms, partners, rewards, exercise catalog. `GET /api/me`, `POST /api/onboarding`, auth; start `lib/server/ai.ts` |
| 4–8 | Step-by-step questionnaire: height and weight, injuries, goal, workout type, time, weekdays; "AI is thinking" screen | `POST /api/plan/generate` with injury filtering, fallback plan, videos from catalog; `GET /api/plan/active` |
| 8–12 | Plan page: week calendar, exercise card with embedded video, set log | `POST /api/sessions`, `coin_ledger`, `POST /api/checkin`, `GET /api/gyms/:id/qr-token` |
| 12–15 | Gym check-in screen (scan QR or enter code), coin balance, streak, gym page with rotating QR | `GET /api/rewards`, `POST /api/rewards/redeem`, `POST /api/billing/subscribe` |
| 15–18 | Coin store, `/checkout` screen (simulated), paywall offering Pro | |
| 18–20 | Nutrition analysis (photo upload, result), partner panel | `POST /api/nutrition/analyze`, `GET /api/partner/stats`, simulated purchase by promo code |
| 20–22 | Polish: loading, errors, empty states, responsive, landing page with the pitch | Rate limits, error handling, AI retry, checking all endpoints in production |
| 22–24 | **Together:** full run on the public URL, demo account, backup screen recording, pitch, submit all items | (same) |

**Feature freeze:** after hour 20 no new features, only fixes and demo prep. If a block (e.g. nutrition) is behind, it
is removed from the demo and presented as a plan, not shown broken.

## 11. Instructions for AI agents, deploy and submission

Each agent (Claude Code for the front, Codex for the back) gets this whole document and its role. Copy the document
into the repository as `docs/SPEC.md`, and put the rules below into `CLAUDE.md` (Claude Code) and `AGENTS.md` (Codex).

### Shared rules for both agents

```
Project: ShowUp, a B2C web app for hackathon Business Cup 2.0. Read docs/SPEC.md first.
Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres/Auth/RLS), Muse Spark 1.3 via Meta Model API, deployed on Vercel.
Rules:
1. Web only, mobile-friendly layout. No native apps. B2C only.
2. The API contract lives in lib/contract. Never change it alone: propose the change in a PR description and wait for the other developer.
3. Stay inside your own folders (see SPEC section Architecture). Do not edit the other person's files.
4. Everything must really work end to end: no hardcoded fake data in production paths. Payment is the only simulated part, and the UI says so.
5. Secrets only in environment variables. Never commit .env files. Never expose server keys with NEXT_PUBLIC_.
6. UI text and data are in English, prices in USD.
7. Small commits, push to the shared repo often, keep main deployable.
8. Before saying a task is done, run the app and check the real flow, not only the types.
```

### Frontend role (Claude Code)

```
You own: app/(site)/**, components/**, styles/**, lib/client/**, public/**.
Build the screens listed in SPEC sections Scope and "Tasks by hours".
Until the backend is ready, use mocks (NEXT_PUBLIC_USE_MOCKS=true) that return exactly the shapes from lib/contract. Switch a mock off as soon as the real endpoint works.
Exercise cards must embed the video with youtube-nocookie.com/embed/{youtube_id}, lazy-loaded, no autoplay, with a plain link under the player.
The checkout screen must show "Demo mode: no real charge".
Design: mobile-first, clean, energetic fitness feel; clear empty, loading and error states.
```

### Backend role (Codex)

```
You own: app/api/**, lib/server/**, supabase/migrations/**, scripts/**.
Implement the endpoints from SPEC section API contract exactly as written, validated with zod from lib/contract.
Follow SPEC sections Data model, Business logic and AI. The AI always picks exercises only from the filtered catalog; the server attaches names and videos.
Require a Supabase session on every endpoint except the ones marked public.
Use RLS and a service role key only on the server.
Coin balance = sum of coin_ledger; spending and rewarding happen in one transaction.
Billing is simulated: POST /api/billing/subscribe just sets is_pro and pro_until and writes subscriptions with source=mock_payment.
Add a fallback plan if the AI call fails twice.
```

### Environment variables (Vercel → Settings → Environment Variables)

| Variable | Available in | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser and server | From Supabase project settings |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser and server | Public key, protected by RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Never with the `NEXT_PUBLIC` prefix |
| `AI_API_KEY` | server only | Meta Model API key (or OpenRouter) |
| `AI_BASE_URL` | server only | From the provider's docs |
| `AI_MODEL` | server only | `muse-spark-1.3` (on OpenRouter and Vercel AI Gateway: `meta/muse-spark-1.3`) |
| `GYM_ADMIN_KEY` | server only | For the gym screen with the QR |
| `NEXT_PUBLIC_USE_MOCKS` | browser | `true` while the backend is not ready |

### Deploy

1. Create an empty GitHub repository and add the teammate as a collaborator.
2. Connect the repository to Vercel (Add New → Project → Import Git Repository), add the variables from the table above.
3. In Supabase apply the migrations and run the seed (gyms, partners, rewards, exercises with videos).
4. Every push to `main` deploys automatically; branches get preview links.

### Demo data

- 3 gyms (fictional names in one US city), 2 sports-nutrition partners (also fictional, to avoid others' trademarks).
- 4–5 rewards in the coin store.
- A demo account with a filled questionnaire, a plan and several check-ins, so the pitch has a history, not an empty
  screen. And a second clean account to show the whole path from scratch.

### Submission checklist

- The public URL works, the whole path can be completed from scratch: sign-up, questionnaire, AI plan with videos, gym
  check-in, coins, redeeming for Pro.
- The repository is clean: no keys, a README with how to run it and an architecture description.
- All three required submission items are ready (check with organizers what they are).
- Pitch: pain, audience, demo, revenue model (subscription + commission), difference from competitors, honestly:
  "billing is a demo, everything else is live".
- A backup screen recording of the demo in case of internet problems.

## 12. Open questions (from the original spec)

- Which exactly are the 3 submission items required by the organizers?
- Is the Muse Spark 1.3 key available from your region, or is OpenRouter needed?
- Does the jury accept simulated payment if everything else is real? (fallback: connect Stripe test mode, about 1–2
  hours)
- Which videos to pick for the exercise catalog (a task for both of you, first 2–3 hours).

### Contract gaps noticed while transcribing (to agree between front and back — not decided here)

- The response shapes for `profile`, `streak`, rewards items, `items`/`totals` are described by table fields, not by
  exact JSON. `lib/contract` must pin them down.
- Weekday numbering 1–7 does not say whether 1 is Monday (ISO) or Sunday.
- The questionnaire has `equipment` and `age` ("added by us"), but `profiles` lists neither column.
- No endpoint returns total XP or the number of workouts completed this week, though both are earned/tracked
  (`workout_sessions.xp`, week bonus).
