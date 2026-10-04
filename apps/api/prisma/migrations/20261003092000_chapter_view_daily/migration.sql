-- gap 3.1 — ยอดเปิดอ่านรายตอนรายวัน สำหรับหน้าสถิตินักเขียน (เดิมไม่มีที่ไหนนับยอดวิวเลย novels.view_count ไม่เคยขยับ)
CREATE TABLE "chapter_view_daily" (
    "chapter_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "chapter_view_daily_pkey" PRIMARY KEY ("chapter_id","day")
);

CREATE INDEX "chapter_view_daily_novel_id_day_idx" ON "chapter_view_daily"("novel_id", "day");

ALTER TABLE "chapter_view_daily" ADD CONSTRAINT "chapter_view_daily_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE CASCADE ON UPDATE CASCADE;
