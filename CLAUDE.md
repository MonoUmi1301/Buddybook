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
- Search State: Unified under `/api/novels/search` accepting `q`, `author`, `workType`, `genre_ids`, `sub_genre_ids`, `pairing_ids`, `fandom_ids`, `tag_ids`.
- Global Mode: Navbar switches between 'original' and 'fanfiction'.
- Onboarding: Mandatory 3-step wizard (No skip) writing to user preferences.