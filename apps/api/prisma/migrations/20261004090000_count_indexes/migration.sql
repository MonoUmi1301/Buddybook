-- เพิ่มภายหลัง (perf) — index สำหรับนับจำนวนต่อนิยาย (lib/novelCounts.ts) แทน _count ใน findMany ที่สแกนทั้งตาราง
-- ผลกระทบ: ไม่เปลี่ยนข้อมูล/พฤติกรรม เพิ่มงานตอน INSERT/UPDATE เล็กน้อย
-- ตารางใหญ่ใน production ควรพิจารณา CREATE INDEX CONCURRENTLY แยกนอก migration เพื่อไม่ล็อกการเขียน

-- นับตอน (ทั้งหมด/เฉพาะที่เผยแพร่) ต่อเรื่อง ได้จาก index อย่างเดียว ไม่ต้องอ่านแถว chapters ที่มีเนื้อหาตอนอยู่ด้วย
-- CreateIndex
CREATE INDEX "chapters_novel_id_status_idx" ON "chapters"("novel_id", "status");

-- นับผู้อ่านต่อเรื่อง (สถิตินักเขียน) — PK (user_id, novel_id) กรองด้วย novel_id ไม่ได้
-- CreateIndex
CREATE INDEX "reading_progress_novel_id_idx" ON "reading_progress"("novel_id");
