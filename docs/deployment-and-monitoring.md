# Deploy และติดตาม Uptime (KPI-5: Availability ≥ 99%)

## 1. Deploy

ทั้งระบบรันด้วย Docker Compose ที่มีอยู่แล้ว (`docker-compose.yml`: postgres, neo4j, api, web + nlp-worker แยก profile)
บน VPS เครื่องเดียวพอสำหรับช่วง UAT 30 คน (แนะนำ 2 vCPU / 4 GB RAM ขึ้นไป เพราะ Neo4j + WangchanBERTa กินหน่วยความจำ)

```bash
git clone <repo> && cd Buddybook
cp apps/api/.env.example apps/api/.env      # ตั้ง JWT_*, INTERNAL_SERVICE_TOKEN, NEO4J_PASSWORD, APP_URL, CORS_ORIGIN
npm run docker:up                            # build + รัน api/web/postgres/neo4j
npm run docker:setup                         # migrate + checks.sql + seed
NLP_MODEL_DIR=/srv/models/my_final_sentiment_model docker compose --profile app --profile nlp up -d
```

- ตั้ง reverse proxy (Caddy/Nginx) ให้ HTTPS และส่ง `X-Forwarded-For` ต่อให้ web — ใช้นับยอดวิวผู้อ่านที่ไม่ล็อกอินและ rate limit
- ค่า env ใหม่ทั้งหมดมีค่า default (ดู README) — ที่ควรตั้งเองตอน deploy: `GOOGLE_OAUTH_REQUEST_BIRTHDAY` (ต้องผ่าน Google verification ก่อน)
- รัน api หลาย instance: ตั้ง `SCHEDULER_ENABLED=false` ทุกตัวยกเว้นตัวเดียว (rate limit/นับวิวเป็นต่อ process)

## 2. Health endpoints

| Endpoint | ใช้ทำอะไร | ตอบ |
|---|---|---|
| `GET /health` | liveness — process ยังทำงาน | 200 เสมอถ้า process ไม่ตาย |
| `GET /health/ready` | readiness — **ใช้อันนี้กับ uptime monitor** | 200 เมื่อ Postgres ตอบได้, 503 เมื่อไม่ได้ พร้อม `{"database","graph","latency_ms"}` |

Neo4j ล่มไม่ทำให้ `/health/ready` เป็น 503 (ระบบหลักยังใช้ได้ ระบบแนะนำ degrade เป็น Postgres) แต่ดูสถานะได้จาก field `graph`

## 3. ตั้ง Uptime monitor (ฟรี)

UptimeRobot (หรือ Better Stack / Uptime Kuma ที่ self-host ได้):

1. สร้าง monitor แบบ **HTTP(s)** → URL `https://<api-domain>/health/ready` → interval **5 นาที**
2. เพิ่ม keyword monitor อีกตัวที่หน้าเว็บ `https://<web-domain>/` หาคำว่า `BuddyBook` (กันกรณี api ปกติแต่ web ล่ม)
3. ตั้ง alert ทางอีเมล/LINE Notify
4. เปิด **Status page** สาธารณะไว้แนบในเล่ม

ช่วง UAT 1 สัปดาห์ (10,080 นาที) ล่มได้ไม่เกิน **100 นาที** ถึงจะยัง ≥ 99% — export รายงาน uptime จาก dashboard
ตอนจบ UAT แล้วใส่ในบทที่ 4 คู่กับผล k6 ที่รันซ้ำบนเครื่องจริง (`k6 run -e API=https://<api-domain> loadtest/buddybook.k6.js`)

## 4. Checklist ก่อนเปิด UAT

- [ ] `npm test` + `npm run typecheck` ผ่านบน commit ที่ deploy
- [ ] `/health/ready` ตอบ `database: ok, graph: ok`
- [ ] NLP worker รันอยู่ (`sentiment_score` ของคอมเมนต์ใหม่ไม่ค้างเป็น null) — ดู log `Processed N items`
- [ ] สั่ง `POST /api/v1/internal/recommendations/sync` หนึ่งครั้งหลัง seed (หรือรอ scheduler 6 ชม.)
- [ ] ทดสอบล็อกอิน Google/Facebook/LINE ด้วย redirect URI ของโดเมนจริง
- [ ] Uptime monitor เปิดแล้วอย่างน้อย 1 วันก่อนเริ่ม
- [ ] สำรองฐานข้อมูลรายวัน (`pg_dump`) ระหว่าง UAT
