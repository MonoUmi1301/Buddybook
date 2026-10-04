# BuddyBook — Gap Analysis & แผนพัฒนาให้ครบตาม Proposal

> **สถานะ (4 ต.ค. 2569): ทำครบทุกข้อในแผนแล้ว ยกเว้น Apple Sign-in (ตัดออกตามที่ตกลง)**
> ผลวัด KPI ดู `docs/evaluation.md` · deploy/uptime ดู `docs/deployment-and-monitoring.md` · endpoint ใหม่ดู `API_Endpoints.md` ส่วนที่ 7
>
> | ข้อ | งาน | สถานะ |
> |---|---|---|
> | 2.1 | Sentiment polarity −1..1 แยกจากความมั่นใจ + backfill + worker ส่ง P(pos)−P(neg) | ✅ |
> | 2.2 | READ edge จากการอ่าน + รวม sentiment คอมเมนต์ + full resync ใหม่ | ✅ |
> | 2.3 | Recommendation v2: scoring, นิยายใหม่, re-rank long-tail, ป้ายเหตุผล, fallback Postgres | ✅ |
> | 2.4 | ลบนิยายแบบ soft delete 30 วัน + หน้านิยายที่ถูกลบ + ลบถาวร | ✅ |
> | 2.5 | Auto-save: ร่างในเครื่อง, keepalive ตอนปิดแท็บ, ออฟไลน์, กู้คืน, กันเขียนทับ (409), แก้ race เลขเวอร์ชัน | ✅ |
> | 3.1 | หน้าสถิตินักเขียน (+ เริ่มนับยอดวิวจริง — เดิมไม่เคยนับ) | ✅ |
> | 3.2 | ระบบแจ้งปัญหา/ซัพพอร์ต + คิวแอดมิน | ✅ |
> | 3.3 | หน้าแจ้งเตือนเต็ม + ปิดรายประเภท | ✅ |
> | 3.4 | ยืนยันอายุจาก Google (เปิดด้วย `GOOGLE_OAUTH_REQUEST_BIRTHDAY`) | ✅ |
> | 3.5 | Social listening ภายใน (แนวโน้ม sentiment + คำที่พูดถึงบ่อย) | ✅ |
> | 3.6 | Apple Sign-in | ⛔ ตัดออก — แนะนำลบออกจาก userflow ให้ตรงกัน |
> | อื่น ๆ | robots.txt กันบอท AI + rate limit อ่านตอน | ✅ |
> | 4.1 | เทสต์ 104 ตัวผ่าน 100% + coverage report (แก้ Proposal: Jest → Vitest) | ✅ |
> | 4.2 | k6 50 ผู้ใช้: เฉลี่ย 4.8 ms, error 0% | ✅ |
> | 4.3 | Offline eval: Precision@10 85.8%, long-tail +94% | ✅ |
> | 4.4 | Playwright fault-tolerance 2/2 | ✅ |
> | 4.5 | OpenAPI สร้างจาก router จริง + Swagger UI | ✅ |
> | 4.6 | `/health/ready` + คู่มือ deploy/uptime — **ต้อง deploy จริงแล้ววัดเอง** | ✅ (เครื่องมือ) |
>
> พบและแก้ระหว่างทาง: ยอดวิวไม่เคยถูกนับ, autosave ล้มเหลวแล้วงานหายเงียบ, autosave พร้อมกันชนเลขเวอร์ชัน,
> อัปโหลดรูปในเนื้อหาตอนโดน proxy ปฏิเสธ, Navbar ล้นจอมือถือ 4px, หน้าอ่านไม่มีขอบซ้ายขวาบนมือถือ

> เทียบโค้ดปัจจุบัน (branch `claude/sharp-feynman-idzpw4`) กับเอกสาร 3 ชิ้น:
> `novel_web_app.pdf` (requirement 8 ข้อ), `Proposal_montira.docx` (ขอบเขต/KPI), `BuddyBook_Userflow.pdf`
> วันที่วิเคราะห์: 3 ต.ค. 2569

---

## 0. สรุปสั้น

ระบบตอนนี้ **ครอบคลุมฟีเจอร์ส่วนใหญ่แล้ว** และหลายส่วนเกินขอบเขตใน proposal ด้วย เช่น ของขวัญ, Stripe/SlipOK, 2FA,
ตอนติดเหรียญ, ถอนรายได้, admin, ชั้นหนังสือ และคอลเลกชัน
แต่ **แกนหลักของงานวิจัย** (ระบบแนะนำที่ลด popularity bias + ความทนทานของ Auto-save และ Soft Delete)
ยังมีจุดที่ **ทำงานผิดหลักการ** และจะทำให้ KPI-1/2/3 ไม่ผ่าน ต้องแก้ส่วนนี้ก่อนฟีเจอร์ใหม่

| สถานะ | จำนวน |
|---|---|
| ✅ ทำแล้วตาม proposal | 18 หัวข้อ |
| 🔴 มีแล้วแต่ทำงานผิด / ไม่ถึง KPI (ต้องแก้ก่อน) | 5 หัวข้อ |
| 🟠 ยังไม่มี (อยู่ในขอบเขต proposal หรือ userflow) | 6 หัวข้อ |
| 🟡 งานทดสอบ/ประเมินผลตามบทที่ 3 ที่ยังไม่มี | 5 หัวข้อ |

---

## 1. Checklist เทียบ requirement

### ✅ ที่มีแล้ว

| Requirement | หลักฐานในโค้ด |
|---|---|
| Login: email/username/password, Google, Facebook, LINE | `apps/api/src/lib/{google,facebook,line}OAuth.ts` |
| Onboarding เลือกความสนใจ (ข้อมูลตั้งต้นให้ระบบแนะนำ) | `components/onboarding/OnboardingWizard.tsx`, `UserInterest` → Neo4j `INTERESTED_IN` |
| Filter tags, หมวด, ค้นหา | `/novels/search`, `app/search` |
| หน้าแรก Hot / Recommend / New | `app/page.tsx` ("ติดท็อป", "ใหม่มาแรง", recommended) |
| รีวิว (ดาว 1–5) + คอมเมนต์ | `Review`, `Comment` |
| Sentiment Analysis (WangchanBERTa) | `apps/nlp-worker` → `/internal/nlp/sentiment-callback` |
| Neo4j graph `User/Novel/Tag`, `INTERESTED_IN/HAS_TAG/READ` | `lib/graphSync.ts`, `recommendations.service.ts` |
| Auto-save ทุก 30 วิ | `ChapterEditorForm.tsx` (`AUTOSAVE_INTERVAL_MS = 30_000`) |
| Version History + restore | `ChapterVersion`, `/chapters/:id/versions/:vid/restore` |
| ถังขยะ 30 วัน + purge อัตโนมัติ (ระดับตอน/ตัวละคร/สถานที่/ไทม์ไลน์) | `TrashBin`, `lib/trash.ts`, scheduler |
| แผนภูมิความสัมพันธ์ตัวละคร (ลากวาง) | `CharacterGraph.tsx` (`@xyflow/react`) |
| ไทม์ไลน์เหตุการณ์ | `TimelineBuilder.tsx` |
| แผนที่จักรวาล + version ของแผนที่ | `WorldMap.tsx`, `MapVersion` |
| ตัวอย่างหน้ากระดาษก่อนพิมพ์ | `write/[novelId]/print-preview` |
| ตั้งค่าการอ่าน, โดเนท, เติมเงิน, แจ้งเตือน (panel), โปรไฟล์, ตั้งค่า | ครบตามหน้าที่ระบุใน 1.3 |
| เปลี่ยนธีม (Dark mode) | Navbar/UserMenu |
| Age gate 18+ | `contentRating.ts`, `users.controller.ts` (คำนวณจาก birth_date) |
| Scheduler (เผยแพร่ตั้งเวลา/purge/resync) | `lib/scheduler.ts` |

---

## 2. 🔴 ต้องแก้ก่อน: บั๊กที่กระทบแกนงานวิจัย

### 2.1 `sentiment_score` เป็นค่า "ความมั่นใจ" ไม่ใช่ "ขั้วความรู้สึก" (สำคัญที่สุด)
- `nlp-worker/src/sentiment.py` ส่ง `score = raw["score"]` ซึ่งเป็น **confidence ของ label ที่ทายได้** (0–1)
- รีวิวที่ **ด่าแรง** (`neg`, score 0.98) จะถูก query Q2/Q3 ใน `recommendations.service.ts` นับเป็น
  `sentiment_score > 0.5` แปลว่า **"ชอบมาก"** ระบบเลยแนะนำนิยายที่คนเกลียดได้
- Proposal 3.2.2 กำหนดไว้ว่า `sentiment_score ∈ [-1.0, 1.0]`

**แก้:**
1. เพิ่มฟิลด์ `sentiment_polarity` (Float, −1..1) ใน `Comment`/`Review` แล้วคำนวณ `pos → +score`, `neg → −score`,
   `neutral → 0` ฝั่ง API (callback) หรือ worker
   (ถ้าจะใช้ softmax ทั้ง 3 คลาส ให้ใช้ `P(pos) − P(neg)` ซึ่งดีกว่า)
2. Neo4j `READ.sentiment_score` ใช้ polarity แทน แล้วปรับ threshold ใน Q2/Q3 (เช่น `> 0.3`)
3. Migration + backfill จากข้อมูลเดิม (`label` + `score` ที่มีอยู่แล้วพอคำนวณได้) แล้วสั่ง `fullResync`
4. เพิ่ม CHECK constraint ของคอลัมน์ใหม่ใน migration (`20261003090000_sentiment_polarity`)

### 2.2 กราฟ `READ` สร้างจาก "รีวิว" เท่านั้น ไม่ได้มาจาก "การอ่าน"
- `syncReadEdge` ถูกเรียกแค่ตอนสร้างรีวิวและตอน sentiment callback ของรีวิว
- `ReadingProgress.upsert` (`chapters.service.ts:269`) **ไม่ได้ sync เข้ากราฟ** ผลคือเงื่อนไข
  `NOT (u)-[:READ]->(n)` ไม่ได้กรองเรื่องที่อ่านไปแล้วจริง ทำให้แนะนำเรื่องที่อ่านอยู่ซ้ำ
- **sentiment ของคอมเมนต์ไม่ถูกใช้ในกราฟเลย** ทั้งที่ proposal ระบุว่าใช้ "คอมเมนต์และรีวิว"

**แก้:** sync `READ` ตอนอ่านตอนแรก (fire-and-forget แบบเดียวกับรีวิว) และให้ `READ.sentiment_score`
= ค่าเฉลี่ยถ่วงน้ำหนักระหว่างรีวิว (น้ำหนักมาก) กับคอมเมนต์ของ user ในนิยายเรื่องนั้น แล้วเพิ่ม property
`read_chapters` / `last_read_at` ไว้ใช้ทำ re-ranking

### 2.3 ระบบแนะนำยังไม่ลด popularity bias อย่างที่ proposal อ้าง
- Q1 (content-based) ใช้ `LIMIT 10` โดย **ไม่มีการจัดอันดับ** ผลลัพธ์จึงเป็นลำดับไหนก็ได้ที่ Neo4j คืนมา
- Q3 (underrated) ต้องมี sentiment ก่อน ผลคือ **นิยายใหม่ที่ยังไม่มีคนอ่านไม่มีทางถูกแนะนำ**
  ซึ่งขัดกับวัตถุประสงค์ข้อ 2 โดยตรง
- หน้าแรกเอา 3 list มาต่อกันแล้ว `.slice(0, 6)` (`app/page.tsx:126`) ทำให้ **content-based กินที่ทั้งหมด**
  และ underrated (long-tail) แทบไม่ได้แสดง KPI-2 จึงวัดผลไม่ได้
- ไม่มี fallback สำหรับ cold-start ทั้ง guest และ user ที่ Neo4j ล่ม

**แก้ (Recommendation v2):**
1. ดึง candidate จาก Q1+Q2+Q3+**Q4 "นิยายใหม่ (≤14 วัน) ที่แท็กตรงความสนใจ"**
2. ให้คะแนนรวม `score = w1·tag_overlap + w2·collab_sim + w3·avg_polarity + w4·freshness`
3. **Personalized re-ranking** (Abdollahpouri 2019) โดยจัดลำดับใหม่แบบ xQuAD หรือการโควตาให้ long-tail
   (เช่น 40% ของ top-10 ต้องเป็นนิยายที่ view_count อยู่ใต้ percentile 80) และให้ค่า λ ปรับได้ผ่าน env
4. API คืน list เดียวที่จัดอันดับแล้ว พร้อม `reason` ("ตรงแนวที่คุณชอบ", "นักอ่านที่ชอบเหมือนคุณ",
   "เพชรในตม", "มาใหม่") เอาไปแสดงเป็นป้ายบนการ์ด
5. Fallback: ถ้าไม่มีกราฟหรือเป็น guest ให้ใช้แท็กยอดนิยมผสมนิยายใหม่จาก Postgres

### 2.4 ลบนิยายเป็น hard delete (ขัดกับ userflow)
- `deleteNovel` ใช้ `prisma.novel.delete` แล้ว cascade ลบทุกตอน ทุกเวอร์ชัน และข้อมูล plot ทันที
- Userflow ระบุว่าต้องมี **"หน้านิยายที่ถูกลบ" → กู้คืน / ลบถาวร (ยืนยันว่ากู้ไม่ได้อีก)**
- `TrashContentType` ไม่มี `novel`

**แก้:** เพิ่ม `Novel.deleted_at` (หรือ `novel` ใน `TrashContentType`), ซ่อนนิยายที่ถูกลบจาก search, graph และ
หน้าโปรไฟล์ เพิ่มหน้า `/write/trash` สำหรับระดับบัญชี มีปุ่มกู้คืนและลบถาวรพร้อม confirm modal ให้ scheduler purge
ทิ้งเมื่อครบ 30 วัน และลบ node ออกจาก Neo4j (เรื่องที่มีคนซื้อตอนแล้วต้องคิดนโยบายแยกด้วย)

### 2.5 Auto-save ยังไม่ถึง KPI-3 (100% ตอนเน็ตหลุด/ปิดเบราว์เซอร์ทันที)
- `ChapterEditorForm.tsx` ไม่มี local buffer, `beforeunload`, หรือการจัดการตอน offline ถ้าปิดแท็บ
  ระหว่างรอบ 30 วินาที **งานที่พิมพ์ไปสูงสุด 30 วินาทีจะหาย** และถ้าเน็ตหลุดตอน autosave ก็หายเงียบ

**แก้:**
1. เขียน draft ลง IndexedDB/localStorage ทุกครั้งที่พิมพ์ (debounce 1–2 วิ) พร้อม `updated_at`
2. ส่ง `navigator.sendBeacon`/`fetch(..., {keepalive:true})` ตอน `visibilitychange=hidden` และตอน `pagehide`
3. ถ้า offline ให้เก็บคิวไว้แล้วส่งใหม่เมื่อ `online` แสดงสถานะ "บันทึกในเครื่องแล้ว / ซิงก์แล้ว / ออฟไลน์"
4. ตอนเปิด editor ให้เทียบ local draft กับเซิร์ฟเวอร์ ถ้า local ใหม่กว่าให้ถามว่าจะกู้คืนหรือไม่
5. กันเขียนทับข้ามแท็บ: ส่ง `base_version`/`updated_at` ไปเทียบ ถ้าชนให้ตอบ 409

---

## 3. 🟠 ฟีเจอร์ที่ยังไม่มี

| # | ฟีเจอร์ | ที่มา | สิ่งที่ต้องทำ |
|---|---|---|---|
| 3.1 | **หน้าสถิตินักเขียน** ("หน้าสถิติ / แสดงสถิตินิยายของฉัน") | Userflow | ตอนนี้มีแค่สถิติของขวัญ ต้องทำ API `/me/novels/:id/stats` ที่ให้ยอดวิวรายตอนตามช่วงเวลา, ผู้อ่านไม่ซ้ำ, อัตราอ่านต่อ (retention ต่อตอน), ไลก์, ผู้ติดตาม, รายได้ และ **สัดส่วน sentiment บวก/ลบ/กลาง** ต้องเพิ่มตาราง `ChapterViewDaily` (aggregate รายวัน) ทำกราฟด้วย Recharts |
| 3.2 | **ระบบแจ้งปัญหา / ซัพพอร์ต** | Proposal 1.3 | `contact/page.tsx` ตอนนี้เป็นหน้าคงที่ ส่วน `ContentReport` ใช้รายงานเนื้อหาเท่านั้น ต้องเพิ่ม `SupportTicket` (หมวด: บัญชี/การเงิน/บั๊ก/อื่น ๆ, แนบรูปได้, สถานะ) หน้า "ตั๋วของฉัน" และหน้า admin ตอบกลับที่ส่งแจ้งเตือนกลับหาผู้ใช้ |
| 3.3 | **หน้าแจ้งเตือนแบบเต็มหน้า** | Proposal 1.3 | ตอนนี้มีแค่ `NotificationPanel` ให้เพิ่ม `/notifications` ที่แบ่งหน้า, กรองตามประเภท, กด "อ่านทั้งหมด" และตั้งค่าการแจ้งเตือนได้ |
| 3.4 | **ดึงอายุจาก OAuth** | Requirement ข้อ 4, Proposal 1.3.2 | ตอนนี้ผู้ใช้กรอก birth_date เอง ให้ขอ scope `https://www.googleapis.com/auth/user.birthday.read` แล้วเรียก People API ถ้าได้ปีเกิดให้ตั้ง `age_verified` และบันทึก `age_verification_source` (oauth/self) ส่วน FB/LINE ถ้าไม่ได้ข้อมูลให้ fallback เป็นกรอกเอง |
| 3.5 | **Social Listening** | Proposal 2.1.2, บทนิยามศัพท์ | ยังไม่มีเลย แนะนำว่า **อย่าไปดึงโซเชียลภายนอก** (ติด ToS/API ค่าใช้จ่ายสูง) ให้นิยามขอบเขตใหม่ว่าเป็น "social listening ภายในแพลตฟอร์ม" คือ dashboard แนวโน้ม sentiment และคีย์เวิร์ดเด่น (PyThaiNLP tokenize + นับความถี่) ต่อนิยายตามเวลา ใช้ร่วมกับ 3.1 แล้ว**แก้ข้อความใน proposal ให้ตรงกัน** |
| 3.6 | **Apple Sign-in** | Userflow (ไม่มีใน proposal) | ใช้ความพยายามต่ำ ถ้าไม่ deploy iOS ให้ตัดออกจาก userflow แทนให้สอดคล้องกัน |

เล็ก ๆ ที่ควรเก็บ:
- **Onboarding**: userflow เขียนว่า "ตอบคำถามสั้น 2 ข้อ" แต่ CLAUDE.md ระบุ wizard 3 ขั้น ให้ปรับเอกสารให้ตรงกับของจริง
- **สรุปเนื้อหาโดยนักเขียน** (requirement ข้อ 5 หมายเหตุ): เพิ่มช่อง "สรุปสั้นสำหรับตัดสินใจอ่าน" แยกจาก synopsis หรือ
  ระบุชัดว่าตัดสินใจไม่ใช้ AI สรุปเพราะกลัวถูกดึงเนื้อหา (ใช้เป็นเหตุผลในเล่มได้)
- **ป้องกัน AI scraping** (requirement ข้อ 5): ใส่ `robots.txt` บล็อก GPTBot/CCBot/ClaudeBot ฯลฯ เฉพาะหน้าอ่านตอน
  และ rate-limit endpoint เนื้อหาตอน

---

## 4. 🟡 งานทดสอบและประเมินผลตามบทที่ 3 (ยังไม่มี แต่ต้องใช้ตอนสอบ)

| # | สิ่งที่ proposal สัญญาไว้ | สถานะตอนนี้ | งานที่ต้องทำ |
|---|---|---|---|
| 4.1 | Unit test ด้วย **Jest** pass ≥ 95% | ใช้ **vitest** มี 5 ไฟล์ ~55 เคส ส่วนใหญ่เป็นเรื่อง gifts | แก้ proposal เป็น vitest (เทียบเท่ากัน) แล้วเพิ่มเทสต์ของ auth, autosave/version restore, trash (soft delete/restore/purge), recommendation scoring/re-ranking (pure function), sentiment polarity mapping และเปิด coverage report |
| 4.2 | Load test **k6** 50 VUs, เฉลี่ย ≤ 3 วิ (KPI-4) | ไม่มี | `loadtest/k6/*.js` ครอบ search, novel detail, read chapter, recommendations, autosave พร้อม threshold `http_req_duration: avg<3000` |
| 4.3 | **Precision@10 ≥ 70%** (KPI-1), **long-tail +20%** (KPI-2) | ไม่มีสคริปต์วัดผล | `apps/api/scripts/eval-recs.ts` สร้าง mock users ที่มี "ground truth" ความชอบ แบ่ง train/test แล้ววัด Precision@10, Long-tail coverage, Gini/APLT **ก่อนและหลัง re-ranking** (สลับด้วย flag) จากนั้น export CSV ไปใส่เล่ม |
| 4.4 | Fault-tolerance test ของ Auto-save (KPI-3) | ไม่มี | Playwright: พิมพ์ → `context.setOffline(true)` → ปิดแท็บ → เปิดใหม่ → ตรวจว่าเนื้อหาครบ 100% (ทำได้หลังข้อ 2.5) |
| 4.5 | OpenAPI spec | มี `API_Endpoints.md` (markdown) | สร้าง `openapi.yaml` จาก zod schema (`zod-to-openapi`) แล้วเปิด `/docs` ด้วย Swagger UI |
| 4.6 | Uptime ≥ 99% (KPI-5) | มี `/health` แต่ยังไม่มี deploy/monitor | deploy (เช่น Render/Railway/VPS + Docker compose) แล้วตั้ง UptimeRobot/Better Stack ยิง `/health` ทุก 5 นาที เก็บ screenshot ช่วง UAT |

---

## 5. แผนดำเนินงาน (เรียงตามลำดับความสำคัญ)

> อิงไทม์ไลน์ใน proposal: ตอนนี้ (ต.ค. 2569) อยู่ช่วงสัปดาห์ที่ 13–15 คือทดสอบ ประเมินผล และเขียนเล่ม
> จึงให้น้ำหนักกับสิ่งที่ **ทำให้ KPI วัดผลได้และผ่าน** ก่อนฟีเจอร์เสริม

### Sprint 1 — แก้แกนวิจัย (สัปดาห์ที่ 1)
- [ ] 2.1 Sentiment polarity −1..1 (schema + worker/callback + backfill + resync)
- [ ] 2.2 READ edge จากการอ่าน + รวม sentiment ของคอมเมนต์
- [ ] 2.3 Recommendation v2: scoring, Q4 นิยายใหม่, re-ranking long-tail, reason label, fallback
- [ ] 4.3 สคริปต์ประเมิน Precision@10 / long-tail (ทำคู่กับ 2.3 จะได้ปรับ λ จากตัวเลขจริง)
- [ ] เทสต์ unit ของ scoring/re-ranking/polarity

### Sprint 2 — ความทนทานของข้อมูลนักเขียน (สัปดาห์ที่ 2)
- [ ] 2.5 Auto-save offline buffer + beacon + recovery prompt + conflict 409
- [ ] 2.4 Soft delete ระดับนิยาย + หน้านิยายที่ถูกลบ + ลบถาวรพร้อม confirm
- [ ] 4.4 Playwright fault-tolerance test
- [ ] เทสต์ integration ของ trash/version restore

### Sprint 3 — ฟีเจอร์ที่ขาดตาม userflow (สัปดาห์ที่ 3)
- [ ] 3.1 หน้าสถิตินักเขียน (รวม sentiment breakdown)
- [ ] 3.5 Social listening ภายใน (dashboard แนวโน้ม + คีย์เวิร์ด) โดยต่อยอดจาก 3.1
- [ ] 3.2 ระบบ support ticket + หน้า admin
- [ ] 3.3 หน้าแจ้งเตือนเต็มหน้า

### Sprint 4 — Non-functional และเตรียมสอบ (สัปดาห์ที่ 4)
- [ ] 4.2 k6 load test + รายงานผล
- [ ] 4.5 OpenAPI + Swagger UI
- [ ] 4.6 Deploy + uptime monitor ก่อนเริ่ม UAT 1 สัปดาห์ (นักเขียน 15 + ผู้อ่าน 15)
- [ ] 3.4 อายุจาก Google OAuth
- [ ] robots.txt กัน AI crawler, ปรับเอกสาร (Jest→vitest, social listening scope, onboarding, Apple)
- [ ] รวบรวมผล KPI-1..5 เป็นตารางสำหรับบทที่ 4

### ตัดออกได้ถ้าเวลาไม่พอ
Apple Sign-in, หน้าแจ้งเตือนเต็มหน้า และ OpenAPI (ใช้ `API_Endpoints.md` แทนได้) **ห้ามตัด** 2.1–2.5 และ 4.3
เพราะเป็นหลักฐานของวัตถุประสงค์ข้อ 2–3 โดยตรง

---

## 6. ความเสี่ยงที่ควรรู้
- **Neo4j cold start**: ระหว่าง UAT 30 คนข้อมูลจะเบาบางมาก Q2 (collaborative) แทบจะว่าง จึงควรวัด KPI-1/2
  บน mock data (ตามที่ proposal เขียนไว้แล้ว) และใช้ UAT วัดแค่ความพึงพอใจ
- **โมเดล sentiment 99.33% accuracy** บน held-out น่าจะ overfit กับ dataset (wisesight + novel_dataset)
  ควรเตรียมชุดคอมเมนต์นิยายจริงประมาณ 200 ข้อความที่ label เอง ไว้รายงาน accuracy ในโดเมนจริงด้วย
- **ลบนิยายที่มีคนซื้อตอนแล้ว**: ต้องกำหนดนโยบาย (ห้ามลบถาวร/คงสิทธิ์อ่าน) ก่อนทำข้อ 2.4
