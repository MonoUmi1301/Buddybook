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

## Testing
- API tests: `npm test` (vitest, needs a migrated + seeded Postgres from `apps/api/.env`).
- Typecheck both apps: `npm run typecheck`. CI: `.github/workflows/ci.yml`.