-- เพิ่มภายหลัง (perf) — index ของคอลัมน์ที่อยู่บน hot path (ดูเหตุผลแต่ละตัวใน schema.prisma)
-- ผลกระทบ: ไม่เปลี่ยนข้อมูล/พฤติกรรม, เพิ่มงานตอน INSERT เล็กน้อย, ตอนนี้ตารางยังเล็ก (<400 แถว) สร้างเสร็จทันที
-- ตารางใหญ่ใน production ควรพิจารณา CREATE INDEX CONCURRENTLY แยกนอก migration เพื่อไม่ล็อกการเขียน

-- CreateIndex
CREATE INDEX "comments_chapter_id_created_at_idx" ON "comments"("chapter_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "novel_tags_tag_id_idx" ON "novel_tags"("tag_id");

-- CreateIndex
CREATE INDEX "user_library_novel_id_idx" ON "user_library"("novel_id");

-- CreateIndex
CREATE INDEX "wallet_transactions_user_id_created_at_idx" ON "wallet_transactions"("user_id", "created_at" DESC);

