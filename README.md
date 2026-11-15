# ShowUp — AI Fitness + Gym Rewards

> You pay for the gym. We make sure you actually go.

## 🚀 Live demo

**👉 https://bus-hack-cup.vercel.app**

> **Login: enter any data.** Any email and any password work, no real account is needed.
> You can also tap **"Continue without an account"** to jump straight in.
>
> Payment is a demo: the checkout screen says **"Demo mode: no real charge"**, so use any card data.

Hackathon project for Business Cup 2.0. Full product and technical spec: [docs/SPEC.md](docs/SPEC.md).

## What is ShowUp

A web app for busy professionals aged 25–45 in the US who pay for a gym membership but go irregularly.

- **AI workout plan** that fits your time, equipment, goal and injuries, with a technique video for every exercise.
- **Workout log** (sets, reps, weight) that awards XP and coins.
- **Gym check-in** with a rotating QR code at a partner gym: coins and a streak for every real visit.
- **Coin store:** spend coins on a month of Pro or a partner promo code.
- **Pro subscription** (simulated payment) with nutrition analysis from a photo.
- **AI Coach** chat that knows your plan, coins and streak.
- **Partner panel** with sales and commission.

Business model: Pro subscription + commission from sports-nutrition partners.

## Tech stack

Next.js (App Router) · TypeScript · Tailwind CSS · Supabase (Postgres, Auth, RLS) · Muse Spark 1.3 via Meta Model API · Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_USE_MOCKS=true until the backend is ready
npm run dev                  # http://localhost:3000 (landing) · /dashboard (app)
```

Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

### Environment variables

Copy `.env.example` to `.env.local` and fill in your own values. Never commit real keys.

| Variable | Where | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Public key, protected by RLS |
| `NEXT_PUBLIC_USE_MOCKS` | browser | `true` = `/api/**` answered by mocks |
| `SUPABASE_SERVICE_ROLE_KEY` | server only | Never use the `NEXT_PUBLIC_` prefix |
| `AI_API_KEY`, `AI_BASE_URL`, `AI_MODEL` | server only | Model provider (`muse-spark-1.3`) |
| `GYM_ADMIN_KEY` | server only | For the gym screen with the rotating QR |

## Mock mode

With mocks on, a "Mock data" badge is shown in the header and auth is mocked: any email/password works, nothing is sent.
Preview UI states with
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

## Disclaimer

ShowUp gives general fitness guidance, not medical advice. Payment is simulated; everything else is live.
