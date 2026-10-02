-- เพิ่มภายหลัง — สติกเกอร์ในคอมเมนต์และรีวิว
-- AlterTable
ALTER TABLE "comments" ADD COLUMN "sticker_id" VARCHAR(32);

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN "sticker_id" VARCHAR(32);
