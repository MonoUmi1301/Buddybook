# การทดสอบและประเมินผล (Proposal บทที่ 3.5)

วิธีวัด KPI ทั้ง 5 ตัวและเทสต์ตามข้อ 3.5.1 ทุกคำสั่งรันซ้ำได้ ผลด้านล่างวัดจริงเมื่อ 4 ต.ค. 2569 บนเครื่องพัฒนา
(Postgres 16 ในเครื่อง, **ไม่มี Neo4j**) ไฟล์ผลดิบอยู่ใน `docs/results/`

| KPI | เกณฑ์ | ผลที่วัดได้ | สถานะ | วิธีวัด |
|---|---|---|---|---|
| KPI-1 Precision@10 | ≥ 70% | **85.8%** (seed 42), 81.9–85.4% (seed 1, 7, 2026) | ผ่าน | `npm run eval:recs --workspace=apps/api` |
| KPI-2 Long-tail เพิ่มขึ้น | ≥ 20% | 21.0% → 40.7% = **+94% (สัมพัทธ์)** / +19.7 จุด | ผ่าน | ชุดเดียวกับ KPI-1 |
| KPI-3 Auto-save ไม่สูญหาย | 100% | **2/2 สถานการณ์ผ่าน** (รัน 3 รอบติด) | ผ่าน | `npm run test:e2e` |
| KPI-4 เวลาตอบสนอง API | เฉลี่ย ≤ 3 วิ ที่ 50 ผู้ใช้พร้อมกัน | **เฉลี่ย 4.8 ms**, p95 10.3 ms, error 0% (11,521 requests) | ผ่าน | `k6 run loadtest/buddybook.k6.js` |
| KPI-5 Availability | ≥ 99% | ต้องวัดหลัง deploy | ยังไม่วัด | ดู `docs/deployment-and-monitoring.md` |
| Unit/Integration pass rate | ≥ 95% | **104/104 = 100%** | ผ่าน | `npm test` |

> **ข้อควรระบุในเล่ม:** โครงการใช้ **Vitest** แทน Jest (API เหมือน Jest เกือบทั้งหมด เร็วกว่าและรองรับ TypeScript/ESM ตรง ๆ)
> ควรแก้ข้อความใน Proposal 3.5.1 ให้ตรงกัน

---

## KPI-1 / KPI-2 — ระบบแนะนำ (offline evaluation บน mock data)

```bash
cd apps/api
npx tsx scripts/eval-recs.ts --seed 42 --csv ../../docs/results/eval-recs-seed42.csv
```

- ใช้โค้ดจัดอันดับตัวจริง (`src/modules/recommendations/ranking.ts`) ส่วนการดึง candidate จำลอง query ของ
  `recommendations.service.ts` ในหน่วยความจำ — ไม่ต้องมีฐานข้อมูล ได้ผลเดิมทุกครั้งเมื่อ seed เท่าเดิม
- โลกจำลอง: นิยาย 600 เรื่อง, ผู้ใช้ 300 คน, อ่านคนละ 20 เรื่อง โดย**การมองเห็นเอียงไปทางเรื่องดังแบบ power-law ที่ไม่ขึ้นกับคุณภาพ**
  (จำลอง popularity bias) ผู้ใช้เลือกความสนใจตอน onboarding ถูกต้อง 70%
- **Ground truth** = เรื่องที่ยังไม่อ่าน ตรงแนวที่ผู้ใช้ชอบจริง และคุณภาพ ≥ 0.5
- **Long-tail** = นิยายที่ยอดวิวไม่อยู่ใน 20% บนสุด (นิยามตาม Abdollahpouri et al.)

| อัลกอริทึม | Precision@10 | สัดส่วน long-tail | Catalog coverage |
|---|---|---|---|
| ยอดนิยม (baseline) | 5.9% | 0.0% | 3.3% |
| v1 เดิม (ก่อนแก้) | 43.7% | 75.7% | 12.5% |
| v2 ไม่ re-rank (λ = 0) | 85.9% | 21.0% | 17.8% |
| **v2 + re-rank (λ = 0.3)** | **85.8%** | **40.7%** | **28.5%** |

อ่านผล: re-ranking เพิ่มสัดส่วน long-tail เกือบ 2 เท่าโดย precision ลดลงแค่ 0.1 จุด และกระจายการแนะนำไปทั่วคลังมากขึ้น
(coverage 17.8% → 28.5%) v1 มี long-tail สูงแต่ precision ต่ำ เพราะส่วน "underrated" เดิมจัดอันดับด้วยความมั่นใจของโมเดล
แทนขั้วความรู้สึก (รีวิวติแรงถูกนับเป็นชอบ — แก้แล้วใน gap 2.1)

**ข้อจำกัด:** เป็นข้อมูลจำลอง (ตามที่ Proposal ระบุ "Mock Data") ช่วง UAT มีผู้ใช้ 30 คน ข้อมูลเบาบางเกินกว่าจะวัด
precision ได้มีความหมาย จึงใช้ UAT วัดความพึงพอใจอย่างเดียว

## KPI-3 — Auto-save fault tolerance (Playwright)

```bash
# ต้องมี api (:4000) + web (:3000) รันอยู่
cd apps/api && npx tsx prisma/seed-e2e.ts
cd ../.. && npm run test:e2e        # e2e/autosave-fault.spec.ts
```

| สถานการณ์ | ขั้นตอน | ผลที่คาดหวัง | ผล |
|---|---|---|---|
| เน็ตหลุดแล้วปิดแท็บทันที | พิมพ์ → ตัดเน็ต → พิมพ์ต่อ → ปิดแท็บ (เซิร์ฟเวอร์ไม่มีทางได้รับ) → เปิดใหม่ | ระบบเสนอกู้คืนจากเครื่อง และได้ข้อความครบทุกตัวอักษร | ผ่าน |
| ปิดแท็บก่อนครบรอบ auto-save 30 วิ | พิมพ์ → ปิดแท็บทันที → เปิดจากเบราว์เซอร์ใหม่ (ไม่มีข้อมูลในเครื่อง) | เซิร์ฟเวอร์ได้เนื้อหาครบจาก keepalive request ตอนปิดแท็บ | ผ่าน |

กลไก: ร่างถูกเขียนลง localStorage ทุก 0.8 วิหลังหยุดพิมพ์, flush ขึ้นเซิร์ฟเวอร์ตอนแท็บถูกซ่อน/ปิด, ซิงก์อัตโนมัติเมื่อกลับมาออนไลน์,
และตรวจการแก้ไขชนกันข้ามแท็บ (409) — integration test ใน `apps/api/test/writer-resilience.integration.test.ts`
ยืนยันว่า auto-save 8 ครั้งพร้อมกันได้ครบ 8 เวอร์ชัน (race ที่พบจาก k6 และแก้แล้ว)

## KPI-4 — Load test (k6)

```bash
cd apps/api && npx tsx prisma/seed-e2e.ts --rich      # ผู้ใช้ e2e_reader1-12 / e2e_writer
k6 run --summary-export=docs/results/summary-50vu.json loadtest/buddybook.k6.js
# ปรับได้: -e VUS=50 -e DURATION=5m -e API=https://api.example.com
```

ผู้ใช้เสมือน 50 คน 2 นาที (+ ramp 25 วิ): 60% ผู้อ่านทั่วไป (ค้นหา → หน้าเรื่อง → อ่านตอน → คอมเมนต์),
30% ผู้อ่านที่ล็อกอิน (แนะนำนิยาย → อ่านตอน → แจ้งเตือน), 10% นักเขียน (auto-save → สถิติ) พร้อมเวลาคิด 1–3 วิ

| Endpoint | avg | p95 | max |
|---|---|---|---|
| ทั้งหมด (11,521 requests) | 4.83 ms | 10.25 ms | 160.9 ms |
| อ่านตอน `GET /chapters/:id` | 2.93 ms | 4.45 ms | 18.6 ms |
| แนะนำนิยาย `GET /recommendations` | 7.78 ms | 12.29 ms | 26.8 ms |
| ค้นหา `GET /novels/search` | 6.44 ms | 9.24 ms | 25.5 ms |
| auto-save `PATCH /chapters/:id/autosave` | 12.32 ms | 17.63 ms | 21.6 ms |

checks 100% (11,495/11,495), http error 0% — รอบแรกพบ auto-save ล้มเหลว 6 ครั้งจาก race ของเลขเวอร์ชัน (แก้ด้วยการล็อกแถวตอน) แล้วรันซ้ำผ่านทั้งหมด

**ข้อจำกัด:** วัดบนเครื่องเดียวกับฐานข้อมูล (ไม่มี network latency) และไม่มี Neo4j (ระบบแนะนำใช้เส้นทาง Postgres)
ควรรันซ้ำบนเครื่องที่ deploy จริงพร้อม Neo4j ก่อนรายงานในเล่ม — สคริปต์รับ `-e API=` ชี้ไปเครื่องจริงได้ทันที

## Unit / Integration tests

```bash
npm test                                   # apps/api — 104 tests (Postgres จริง)
npm run test:coverage --workspace=apps/api # รายงาน coverage → apps/api/coverage/index.html
python -m unittest discover -s apps/nlp-worker/tests   # การแปลงผลโมเดลเป็นขั้วความรู้สึก
```

Coverage ปัจจุบัน: statements/lines 59.2%, branches 77.7%, functions 49.6%
(ส่วนที่ยังไม่ครอบคือ admin, gifts UI flow และ OAuth callback ที่ต้องคุยกับผู้ให้บริการภายนอก)

## Sentiment model — ข้อเสนอเพิ่มเติม

โมเดลรายงาน 99.33% accuracy บน held-out ของชุดฝึก (wisesight + novel_dataset) ซึ่งน่าจะสูงเกินจริงในโดเมนคอมเมนต์นิยาย
แนะนำให้สุ่มคอมเมนต์จริง ~200 ข้อความจากช่วง UAT มา label เองแล้วรายงาน accuracy/F1 แยกอีกชุด
