# BuddyBook บน Docker (dev)

มี 2 โหมด — เลือกตามแรงเครื่อง

| โหมด | อะไรอยู่ใน Docker | api/web รันยังไง |
|---|---|---|
| **ทั้งหมด** | postgres, neo4j, api, web | ใน container (hot reload) |
| **DB อย่างเดียว** | postgres, neo4j | Node บนเครื่องเหมือนเดิม |

วิธีรันด้วย Node แบบเดิม (PostgreSQL บน Windows พอร์ต 5432 + Neo4j Aura ตาม `apps/api/.env`) ยังใช้ได้ทุกอย่าง
ไฟล์ `.env` เดิมไม่ถูกแก้ — ค่าเฉพาะ Docker อยู่ใน `docker/api.docker.env` / `docker/host.docker.env`

## ใช้ PostgreSQL บน Windows แทน container postgres

ถ้ามีบัญชี/ข้อมูลจริงอยู่ใน PostgreSQL บนเครื่อง (5432) อยู่แล้ว ให้ api ใน Docker ใช้ DB นั้นได้ โดยสร้างไฟล์ `.env`
ที่ root (gitignored — compose อ่านเอง):

```
DOCKER_DATABASE_URL=postgresql://postgres:<รหัสผ่าน>@host.docker.internal:5432/buddybook?schema=public
```

แล้ว `docker compose --profile app up -d api` ใหม่ — ลบบรรทัดนี้เพื่อกลับไปใช้ container postgres (5525)

> ⚠️ โหมดนี้ **อย่ารัน `npm run docker:setup` แบบเต็ม** — ขั้น seed-mock-novels ลบแล้วสร้างนิยาย mock ใหม่
> (uuid เปลี่ยน) ของในชั้นหนังสือ/ถูกใจของบัญชีจริงที่ชี้ไปนิยาย mock จะหายตาม ใช้ `-- --skip-mock` แทน

## Resource limits

| service | memory | cpus | หมายเหตุ |
|---|---|---|---|
| postgres (16-alpine) | 512M | 1.0 | `shared_buffers=128MB`, host port **5525** |
| neo4j (5-community) | 1G | 1.0 | heap 256m–512m, pagecache 256m, Browser http://localhost:7474 |
| api | 768M | 1.0 | nodemon polling 1 วิ |
| web | 1.5G | 1.5 | `next dev` + `WATCHPACK_POLLING` |

ใช้จริงตอน idle ราว 1.4 GB รวม — ปรับได้ที่ `deploy.resources.limits` ใน `docker-compose.yml`

แนะนำจำกัด VM ของ Docker Desktop เองด้วย (ค่า default กินได้ถึงครึ่งหนึ่งของแรมเครื่อง) — สร้างไฟล์
`%USERPROFILE%\.wslconfig` แล้ว `wsl --shutdown` หนึ่งครั้ง:

```ini
[wsl2]
memory=4GB
processors=4
swap=2GB
```

## คำสั่ง

> ใช้ `npm run ...` ได้เมื่อ ComSpec ของเครื่องชี้ `C:\Windows\system32\cmd.exe` ถูกต้อง
> ถ้ายังไม่ได้แก้ ใช้คำสั่ง `docker compose ...` ในวงเล็บแทนได้เลย

### โหมดทั้งหมด

| ทำอะไร | คำสั่ง |
|---|---|
| เปิด (build ถ้าจำเป็น) | `npm run docker:up` (`docker compose --profile app up -d --build`) |
| ตั้งค่า DB + seed ครั้งแรก | `npm run docker:setup` (`docker compose --profile app exec api node scripts/db-setup.mjs`) |
| ดู log ทุกตัว | `npm run docker:logs` — เฉพาะตัว: `docker compose logs -f api` |
| ดูสถานะ | `npm run docker:ps` / `docker stats` |
| ปิด (ข้อมูลอยู่ครบ) | `npm run docker:down` (`docker compose --profile app down`) |
| หลังเพิ่ม/ลบ dependency | `npm run docker:rebuild` (build ใหม่ + ล้าง node_modules volume ของ api/web) |

เว็บ http://localhost:3000 · API http://localhost:4000 · Neo4j Browser http://localhost:7474 (neo4j / buddybook-dev)

### โหมด DB อย่างเดียว

| ทำอะไร | คำสั่ง |
|---|---|
| เปิด DB | `npm run docker:db` (`docker compose up -d --wait`) |
| ตั้งค่า DB + seed | `npm run docker:setup:dockerdb` (`cd apps/api && node --env-file=../../docker/host.docker.env scripts/db-setup.mjs`) |
| รัน api ชี้ DB ใน Docker | `npm run dev:api:dockerdb` |
| รัน web | `npm run dev:web` (เหมือนเดิม) |
| ปิด | `npm run docker:down` |

ถ้ารัน `docker:setup:dockerdb` ตอน api ยังไม่เปิด ขั้น sync Neo4j จะถูกข้าม — เปิด api แล้วรัน
`node --env-file=../../docker/host.docker.env scripts/db-setup.mjs --only-graph` (ใน `apps/api`)

### Seed / reset

| ทำอะไร | คำสั่ง |
|---|---|
| seed ใหม่ (รันซ้ำได้) | `npm run docker:setup` — ข้อมูล mock ชุดเดิมถูกลบแล้วสร้างใหม่ ข้อมูลที่สมัครเองไม่หาย |
| ข้าม mock | ต่อท้าย `-- --skip-mock` |
| **reset DB ทั้งหมด** (ลบ volume) | `npm run docker:reset` แล้ว `npm run docker:up` + `npm run docker:setup` |

## ลำดับ setup (`apps/api/scripts/db-setup.mjs`)

1. `prisma migrate deploy` — migration `prisma/migrations/0_init` (สร้างจาก schema.prisma ปัจจุบัน)
   (รวม CHECK constraints — migration `20260930100000_manual_check_constraints`)
2. `prisma/seed.ts` — แท็ก/หมวดหมู่
3. `prisma/seed-mock-novels.ts` — ข้อมูล mock
4. `prisma/seed-demo-library.ts` — ผู้ใช้เดโม My Library
5. `POST /api/v1/internal/recommendations/sync` — สร้างกราฟ Neo4j จาก Postgres

หยุดทันทีที่ขั้นไหนล้มเหลว

## หมายเหตุ

- **Migration**: เดิมโปรเจกต์ใช้ `db push` ไม่มีโฟลเดอร์ migrations — ตอนนี้มี `0_init` เป็น baseline แล้ว
  DB เดิมบนเครื่อง (5432) ถูก `migrate resolve --applied 0_init` ไว้แล้ว เปลี่ยน schema ต่อจากนี้ให้ใช้
  `npm run prisma:migrate` (สร้าง migration ใหม่) แทน `db push`
- **Hot reload**: bind mount จาก Windows ไม่ส่ง file event เข้า container จึงใช้ polling (api: nodemon ทุก 1 วิ,
  web: watchpack) ถ้าอยากให้เร็ว/เบากว่านี้ ย้าย repo ไปไว้ในไฟล์ระบบของ WSL (`\\wsl$\...`)
- **`.next` ของ web ใน Docker แยก volume** จาก `apps/web/.next` บนเครื่อง — รัน `next dev` ทั้งบนเครื่องและใน
  Docker พร้อมกันไม่ได้อยู่ดี เพราะชนพอร์ต 3000
- `apps/nlp-worker` (Python) ยังไม่อยู่ใน compose
