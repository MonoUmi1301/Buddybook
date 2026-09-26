# BuddyBook — buddybook_code

Monorepo (npm workspaces) สำหรับโค้ดจริงของแพลตฟอร์ม BuddyBook อ้างอิงสเปกทั้งหมดจาก `buddybook_real`

```
apps/
  web/          Next.js 14 (App Router, TypeScript, Tailwind CSS)
  api/           Node.js/Express API Gateway (TypeScript, Prisma → PostgreSQL 16)
  nlp-worker/    Python 3.11 — Thai Sentiment Analysis (WangchanBERTa)
```

สถานะปัจจุบัน: **ใช้งานได้ครบทุก endpoint** ใน `API_Endpoints.md` (ไม่มี endpoint ที่ตอบ 501 แล้ว) รวมส่วนขยาย
ที่เพิ่มภายหลัง — ของขวัญ/เติมเงิน Stripe, ชั้นหนังสือ/คอลเลกชัน, 2FA, ติดตามนักเขียน, รายงานเนื้อหา, ตอนติดเหรียญ
และถอนรายได้นักเขียน (ดูส่วนที่ 6 ของ `API_Endpoints.md`)

## เริ่มต้นใช้งาน

### 1. Backend API (`apps/api`)

```bash
cd apps/api
cp .env.example .env
# แก้ DATABASE_URL ให้ตรงกับ connection ที่สร้างไว้ใน DBeaver (Postgres 16)
# ต้องรันครั้งเดียวใน DB: CREATE EXTENSION IF NOT EXISTS pgcrypto;

npm install                 # ติดตั้งจาก root ก็ได้ (npm workspaces): npm install ที่ root
npm run prisma:generate     # generate Prisma Client
npm run prisma:migrate      # สร้างตารางทั้งหมดใน Postgres
psql "$DATABASE_URL" -f prisma/migrations_manual/checks.sql   # เพิ่ม CHECK constraints ที่ Prisma ประกาศแบบ declarative ไม่ได้

npm run dev                 # http://localhost:4000  (GET /health เช็คว่ารันติด)
```

### 2. Frontend (`apps/web`)

```bash
cd apps/web
cp .env.example .env
npm install
npm run dev                 # http://localhost:3000
```

### 3. NLP Worker (`apps/nlp-worker`)

```bash
cd apps/nlp-worker
python3.11 -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env        # DATABASE_URL เดียวกับ apps/api
python src/main.py
```

`MODEL_PATH` ต้องชี้ไปที่โฟลเดอร์โมเดล fine-tuned (`my_final_sentiment_model` ~400MB — อยู่นอก repo ตั้งใจ)
ถ้าไม่รัน worker นี้ `sentiment_score` ของคอมเมนต์/รีวิวจะเป็น `null` ตลอด และคำแนะนำนิยายจาก Neo4j ที่อิง sentiment จะว่าง

รันใน Docker ได้ด้วย (profile `nlp` แยก เพราะต้องมีโฟลเดอร์โมเดล):

```bash
NLP_MODEL_DIR=/path/to/my_final_sentiment_model docker compose --profile app --profile nlp up -d
```

### รันทั้งหมดจาก root (แนะนำ)

```bash
npm install              # ติดตั้งทุก workspace พร้อมกัน
npm run dev:api          # apps/api
npm run dev:web          # apps/web (คนละ terminal)
```

## งานเบื้องหลัง (Scheduler)

api รันงานตามเวลาใน process ของตัวเอง (`apps/api/src/lib/scheduler.ts`) ไม่ต้องตั้ง cron แยก:

| งาน | ค่า default | env |
|---|---|---|
| เผยแพร่ตอนที่ตั้งเวลาไว้ | ทุก 60 วิ | `SCHEDULE_PUBLISH_INTERVAL_SEC` |
| ลบของในถังขยะที่เกิน 30 วัน | ทุก 1 ชม. | `SCHEDULE_TRASH_PURGE_INTERVAL_SEC` |
| sync กราฟแนะนำนิยายเข้า Neo4j | ทุก 6 ชม. | `SCHEDULE_RECOMMENDATION_SYNC_INTERVAL_SEC` |

ปิดได้ด้วย `SCHEDULER_ENABLED=false` (เช่น รัน api หลาย instance ให้เปิดแค่ตัวเดียว หรือจะใช้ cron ภายนอกยิง
`/internal/*` แทน) — ปิดเองอัตโนมัติตอน `NODE_ENV=test`

## ค่า env ที่เพิ่มภายหลัง (`apps/api/.env`, มีค่า default ทั้งหมด)

| env | default | ความหมาย |
|---|---|---|
| `AUTH_RATE_LIMIT_PER_15MIN` | 20 | จำนวนครั้ง login/OTP/ลืมรหัสผ่าน ต่อบัญชีเป้าหมาย ต่อ 15 นาที |
| `CHAPTER_PLATFORM_FEE_PERCENT` | 10 | ค่าธรรมเนียมแพลตฟอร์มจากการขายตอนติดเหรียญ |
| `WITHDRAWAL_MIN_COINS` | 500 | ถอนรายได้ขั้นต่ำต่อครั้ง |
| `COIN_TO_THB_RATE` | 1 | อัตราแลก coin → บาทตอนถอน |

## การทดสอบ

```bash
# ต้องมี Postgres ที่ migrate + seed แล้วตาม DATABASE_URL ใน apps/api/.env
npm test              # vitest ของ apps/api (integration ยิง HTTP จริง สร้าง/ลบข้อมูลทดสอบเอง)
npm run typecheck     # ทั้ง api และ web
npm run lint
```

CI (`.github/workflows/ci.yml`) รันทั้งหมดนี้บน Postgres 16 ทุก PR + `next build` ของ web

## เอกสารอ้างอิง

- Schema: `apps/api/prisma/schema.prisma` (18 models, 12 enums) + `apps/api/prisma/migrations_manual/checks.sql`
- API contract: `API_Endpoints.md` (74 endpoints, 5 กลุ่ม)
- Business logic / ER / DFD / Use Case ทั้งหมด: โฟลเดอร์ `buddybook_real`
