# ShowUp — Claude Code (frontend)

Project: ShowUp, a B2C web app for hackathon Business Cup 2.0. Read docs/SPEC.md first.
Stack: Next.js (App Router) + TypeScript + Tailwind, Supabase (Postgres/Auth/RLS), Muse Spark 1.3 via Meta Model API, deployed on Vercel.

Rules (SPEC §11):
1. Web only, mobile-friendly layout. No native apps. B2C only.
2. The API contract lives in lib/contract. Never change it alone: propose the change in a PR description and wait for the other developer.
3. Stay inside your own folders (see SPEC section Architecture). Do not edit the other person's files.
4. Everything must really work end to end: no hardcoded fake data in production paths. Payment is the only simulated part, and the UI says so.
5. Secrets only in environment variables. Never commit .env files. Never expose server keys with NEXT_PUBLIC_.
6. UI text and data are in English, prices in USD.
7. Small commits, push to the shared repo often, keep main deployable.
8. Before saying a task is done, run the app and check the real flow, not only the types.

Frontend role:
- You own: app/(site)/**, components/**, styles/**, lib/client/**, public/**.
- Until the backend is ready, use mocks (NEXT_PUBLIC_USE_MOCKS=true) that return exactly the shapes from lib/contract. Switch a mock off as soon as the real endpoint works.
- Exercise cards embed youtube-nocookie.com/embed/{youtube_id}, lazy-loaded, no autoplay, with a plain "Watch on YouTube" link under the player.
- The checkout screen must show "Demo mode: no real charge".

## Frontend conventions
- Design system "Dark Athletic Performance": tokens in `styles/globals.css` (use `bg-surface`, `text-muted`, `border-line`, `text-lime`, `font-display`, `text-hero`/`text-metric`; never raw hex in components).
- UI primitives in `components/ui/*`; shell/nav in `components/shell/*`; feature sections in `components/<feature>/*`.
- All API calls go through `lib/client/api.ts` (`apiRequest`) or `useApi` and are validated with zod schemas from `lib/contract`.
- Mocks live only in `lib/client/mocks.ts`; check UI states with `?mock=rest_day|new_user|no_plan|empty_rewards|pro|error|unauthorized|offline|slow`.
- Commands: `npm run dev`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.
