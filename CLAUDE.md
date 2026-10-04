# Project: BuddyBook (Web Novel & Fanfiction Platform)

## Tech Stack
- Frontend: Next.js (apps/web) - Port 3000
- Backend: Express (apps/api) - Port 4000
- Database: PostgreSQL (Port 5525) + Prisma ORM + Neo4j
- Styling: Tailwind CSS

## Common Commands
- Setup dependencies: `npm install`
- Prisma generate: `npm run prisma:generate`
- Prisma migrate: `npm run prisma:migrate`
- Run Dev (API): `cd apps/api && npm run dev`
- Run Dev (Web): `cd apps/web && npm run dev`

## Core Rules & Architecture
- Search State: Unified under `/api/v1/novels/search` accepting `q`, `author`, `workType`, `genre_ids`, `sub_genre_ids`, `pairing_ids`, `fandom_ids`, `tag_ids`.
- Global Mode: Navbar switches between 'original' and 'fanfiction'.
- Onboarding: Mandatory 3-step wizard (No skip) writing to user preferences.
- Background jobs: `apps/api/src/lib/scheduler.ts` runs scheduled-chapter publishing, trash purge and Neo4j resync in-process (`SCHEDULER_ENABLED`, off under `NODE_ENV=test`).
- Money: every wallet write goes through `lockWallets` + `getBalance` inside one `$transaction` (see gifts, chapter purchases, withdrawals).
- Sentiment: `sentiment_score` is model confidence (0..1); recommendations use `sentiment_polarity` (−1..1, `lib/sentiment.ts`). Neo4j `READ.sentiment_score` holds the combined polarity.
- Recommendations: candidates → `ranking.ts` (`relevanceScore` + `rerankLongTail`); never use views as a positive signal. Validate changes with `npm run eval:recs`.
- Deleting a novel is a 30-day soft delete (`deleted_at`, visibility forced to private); owner-scoped queries must filter `deleted_at: null`.
- Chapter autosave locks the chapter row (`FOR UPDATE`) to number versions; editor keeps a localStorage draft (`lib/draftStore.ts`).
- Responsive: desktop-first, then iPad (820/1180) and phone (390) — no page-level horizontal scroll.

## Testing
- API tests: `npm test` (vitest, needs a migrated + seeded Postgres from `apps/api/.env`).
- Typecheck both apps: `npm run typecheck`. CI: `.github/workflows/ci.yml`.
- E2E (Playwright, needs api+web running and `npx tsx prisma/seed-e2e.ts`): `npm run test:e2e`. Load test: `k6 run loadtest/buddybook.k6.js`. See `docs/evaluation.md`.