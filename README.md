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

## Structure

| Path | Owner |
|---|---|
| `app/(site)/**`, `components/**`, `styles/**`, `lib/client/**`, `public/**` | Frontend |
| `app/api/**`, `lib/server/**`, `supabase/migrations/**`, `scripts/**` | Backend |
| `lib/contract/**` | Shared — changes need both developers |
