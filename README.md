# BuddyBook — buddybook_code

Monorepo (npm workspaces) สำหรับโค้ดจริงของแพลตฟอร์ม BuddyBook อ้างอิงสเปกทั้งหมดจาก `buddybook_real`

```
apps/
  web/          Next.js 14 (App Router, TypeScript, Tailwind CSS)
  api/           Node.js/Express API Gateway (TypeScript, Prisma → PostgreSQL 16)
  nlp-worker/    Python 3.11 — Thai Sentiment Analysis (WangchanBERTa)
```

สถานะปัจจุบัน: **skeleton ที่รันได้จริง ยังไม่มี business logic ครบทุก endpoint**
(ดู `API_Endpoints.md` — endpoint ที่ยัง `501 Not Implemented` มีคอมเมนต์ `TODO`/label กำกับไว้
ว่าให้ implement ตาม pattern ของ `apps/api/src/modules/auth` และ `apps/api/src/modules/novels`
ซึ่งเป็นตัวอย่างที่ต่อ Prisma จริงแล้ว)

## ⚠️ ข้อจำกัดของ sandbox ที่ใช้เขียนโค้ดนี้

Sandbox ที่ใช้สร้างไฟล์ชุดนี้ไม่มีสิทธิ์เข้าถึง npm registry / PyPI (นโยบายความปลอดภัย) จึง
**ไม่สามารถรัน `npm install`, `prisma validate`, `prisma generate`, `next build`, หรือ `pip install`
เพื่อตรวจสอบอัตโนมัติได้ในสภาพแวดล้อมนี้** ไฟล์ทั้งหมดผ่านการรีวิวโค้ดด้วยมืออย่างละเอียด
(ตรวจ import path, ตรวจ relation ใน Prisma schema, ตรวจ syntax ผ่าน Python `py_compile`) แต่ยัง
**ต้องรัน `npm install` และ `pip install -r requirements.txt` บนเครื่องจริงของคุณเพื่อยืนยันอีกครั้ง**
ก่อนใช้งานจริง

## เริ่มต้นใช้งาน

### 1. Backend API (`apps/api`)

```bash
cd apps/api
cp .env.example .env
# แก้ DATABASE_URL ให้ตรงกับ connection ที่สร้างไว้ใน DBeaver (Postgres 16)
# ต้องรันครั้งเดียวใน DB: CREATE EXTENSION IF NOT EXISTS pgcrypto;

npm install                 # ติดตั้งจาก root ก็ได้ (npm workspaces): npm install ที่ root
npm run prisma:generate     # generate Prisma Client
npm run prisma:migrate      # สร้างตารางทั้ง 18 ตัวใน Postgres
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

โมเดล WangchanBERTa จริงยังไม่ได้ fine-tune/ต่อเข้าไป — ดู `TODO` ใน `apps/nlp-worker/src/sentiment.py`

### รันทั้งหมดจาก root (แนะนำ)

```bash
npm install              # ติดตั้งทุก workspace พร้อมกัน
npm run dev:api          # apps/api
npm run dev:web          # apps/web (คนละ terminal)
```

## สิ่งที่ implement เป็นตัวอย่างไว้แล้ว (reference pattern)

- `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh` — bcrypt hash + JWT
- `GET /api/v1/users/me` — ตัวอย่างการใช้ `requireAuth` middleware
- `GET /api/v1/novels/search`, `GET /api/v1/novels/:novel_id` — Prisma query จริง พร้อม pagination/filter

Endpoint ที่เหลือทั้งหมดถูกกำหนด route + auth middleware ไว้ครบตาม `API_Endpoints.md`
แต่ controller ยัง return `501 Not Implemented` — เติม business logic ตามลำดับความสำคัญของ thesis ได้เลย

## เอกสารอ้างอิง

- Schema: `apps/api/prisma/schema.prisma` (18 models, 12 enums) + `apps/api/prisma/migrations_manual/checks.sql`
- API contract: `API_Endpoints.md` (74 endpoints, 5 กลุ่ม)
- Business logic / ER / DFD / Use Case ทั้งหมด: โฟลเดอร์ `buddybook_real`
