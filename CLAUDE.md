# Project: BuddyBook (Web Novel & Fanfiction Platform)

## Tech Stack
- Node.js ≥22.12 (CI/Docker use 24) — sanitize-html and vitest need it.
- Frontend: Next.js 16 + React 19 (apps/web) - Port 3000. Request APIs are async (`await cookies()`, `await params`); `src/proxy.ts` (formerly middleware) refreshes tokens and sets a per-request CSP nonce.
- Backend: Express (apps/api) - Port 4000
- Database: PostgreSQL + Prisma ORM + Neo4j
  - Dev DB the app actually uses: native Windows PostgreSQL 18 at `localhost:5525/buddybook`, user `postgres` (`apps/api/.env`). PostgreSQL 17 on port 1301 is a different server (different password) — the app does not use it. The Docker `postgres` service also maps 5525 — don't run both.
  - `npm run db:check` shows which DB the app uses and what each local Postgres holds; `npm run db:backup` dumps it to `backups/` (gitignored).
  - Never run `prisma migrate dev` / `migrate reset` / `db push --force-reset` against the dev DB without a backup — on 2026-10-22 an `npm run prisma:migrate` (= `migrate dev`) most likely reset it and the data was lost. Apply migrations with `npx prisma migrate deploy`. `npm run prisma:migrate` now backs up first.
  - Never pass the dev `DATABASE_URL` as `--shadow-database-url`; Prisma resets the shadow DB.
- Styling: Tailwind CSS

## Common Commands
- Setup dependencies: `npm install`
- Prisma generate: `npm run prisma:generate`
- Apply migrations (safe, never deletes data): `cd apps/api && npx prisma migrate deploy`
- Create a new migration (dev only, backs up first): `npm run prisma:migrate`
- Back up the dev DB: `npm run db:backup`
- Run Dev (API): `cd apps/api && npm run dev`
- Run Dev (Web): `cd apps/web && npm run dev`
- Production (VPS): `docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build` (template `.env.production.example`). Nginx (`docker/nginx/nginx.conf`) sends everything incl. `/api/v1/*` to web — Next Route Handlers turn the cookie into a Bearer token; only `/api/v1/webhooks/*` goes straight to api. `API_URL` and `NEXT_PUBLIC_*` are baked in at `next build`.

## Core Rules & Architecture
- Search State: Unified under `/api/v1/novels/search` accepting `q`, `author`, `workType`, `genre_ids`, `sub_genre_ids`, `pairing_ids`, `fandom_ids`, `tag_ids`.
- Global Mode: Navbar switches between 'original' and 'fanfiction'.
- Onboarding: Mandatory 3-step wizard (No skip) writing to user preferences.
- Background jobs: `apps/api/src/lib/scheduler.ts` runs scheduled-chapter publishing, trash purge and Neo4j resync in-process (`SCHEDULER_ENABLED`, off under `NODE_ENV=test`).
- Money: every wallet write goes through `lockWallets` + `getBalance` inside one `$transaction` (see gifts, chapter purchases, withdrawals).
- Sentiment: `sentiment_score` is model confidence (0..1); `sentiment_polarity` (−1..1) is the raw text polarity. Reviews also store `blended_polarity` (text + stars, `blendReviewPolarity` in `lib/sentiment.ts`) — recommendations use that for reviews and raw polarity for comments. Neo4j `READ.sentiment_score` holds the combined polarity. Target tags are an array `sentiment_targets` (character/immersion/work); writers only see the positive side, the rest is admin-only.
- Recommendations: candidates → `ranking.ts` (`relevanceScore` + `rerankLongTail`); never use views as a positive signal. Validate changes with `npm run eval:recs`.
- Content rating gate: `all_ages` open to everyone, `teen` needs verified age ≥13, `mature` ≥18; unverified = `all_ages` only. Only proven sources count: `kyc` or `google` (no self-declared birth dates — removed, DB CHECK enforces it). Age comes from `users.birth_date` via `lib/contentRating.ts` — every endpoint returning novel data must use `assertContentRatingAllowed` / `contentRatingWhere`. kyc overrides google, never the reverse. e-KYC (ID/passport + liveness via Didit hosted flow, `modules/kyc`, `docs/age-verification-kyc.md`) never stores images, names or ID numbers — only birth date, status, consent record and an HMAC of the document number; provider sessions are deleted via API as soon as the result is final.
- Demo vs real data: `users.account_type` (DEMO/REAL, default REAL, separate from `role`) + `is_demo` on novels/chapters/comments/reviews/donations/novel_likes/chapter_purchases (follows the creator, not the novel). DEMO accounts cannot log in, refresh or reset passwords (same error as a wrong password); signup always writes REAL. Every seed must set `account_type: "DEMO"` / `is_demo: true` (e2e seeds excepted — they need to log in). Relabel existing rows with `npm run db:mark-demo` (only touches users created before migration `20261026090000_demo_real_accounts`, safe to re-run), then `npm run graph:sync-accounts`. Web shows `components/ui/DemoBadge.tsx`; recommendations still use DEMO data.
- Deleting a novel is a 30-day soft delete (`deleted_at`, visibility forced to private); owner-scoped queries must filter `deleted_at: null`.
- Security headers: CSP lives in `apps/web/src/proxy.ts` (nonce + `strict-dynamic`); a new inline script needs `nonce={(await headers()).get("x-nonce")}`, and a new third-party script/frame/API host must be added there. Static headers are in `next.config.mjs`.
- Chapter content is HTML rendered with `dangerouslySetInnerHTML`: always pass it through `toSafeChapterHtml` (`lib/richText.ts`) on write and on read; novel introductions use `toSafeRichText`.
- Rate limits (`middleware/rateLimit.middleware.ts`) are stored in the `rate_limits` table (shared across instances); tests reset them with `await resetRateLimits()`.
- Async event handlers in the web app go through `handleAsync` (`lib/handleAsync.ts`); lint enforces `no-floating-promises` / `no-misused-promises` in both apps.
- Chapter autosave locks the chapter row (`FOR UPDATE`) to number versions; editor keeps a localStorage draft (`lib/draftStore.ts`).
- Responsive: desktop-first, then iPad (820/1180) and phone (390) — no page-level horizontal scroll.

## Testing
- API tests: `npm test` (vitest, needs a migrated + seeded Postgres from `apps/api/.env`).
- Typecheck both apps: `npm run typecheck`. Lint: `npm run lint` (web uses ESLint 9 flat config `apps/web/eslint.config.mjs`). CI: `.github/workflows/ci.yml`.
- E2E (Playwright, needs api+web running and `npx tsx prisma/seed-e2e.ts --rich` — without `--rich` only `e2e_writer` is created, no readers/`e2e_admin`; password `e2e12345`): `npm run test:e2e`. Load test: `k6 run loadtest/buddybook.k6.js`. See `docs/evaluation.md`.