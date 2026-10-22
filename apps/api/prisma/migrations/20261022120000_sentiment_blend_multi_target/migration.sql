-- 1) ป้ายเป้าหมายเก็บได้หลายป้าย (เช่น ชมตัวละคร + ติงานเขียน) — ย้ายค่าป้ายเดียวเดิมเข้า array แล้วลบคอลัมน์เก่า
ALTER TABLE "comments" ADD COLUMN "sentiment_targets" "SentimentTarget"[] NOT NULL DEFAULT ARRAY[]::"SentimentTarget"[];
ALTER TABLE "reviews"  ADD COLUMN "sentiment_targets" "SentimentTarget"[] NOT NULL DEFAULT ARRAY[]::"SentimentTarget"[];
UPDATE "comments" SET "sentiment_targets" = ARRAY["sentiment_target"] WHERE "sentiment_target" IS NOT NULL;
UPDATE "reviews"  SET "sentiment_targets" = ARRAY["sentiment_target"] WHERE "sentiment_target" IS NOT NULL;
ALTER TABLE "comments" DROP COLUMN "sentiment_target";
ALTER TABLE "reviews"  DROP COLUMN "sentiment_target";

-- 2) ขั้วของรีวิวหลังผสมดาว — sentiment_polarity ยังเป็นค่าดิบจากโมเดลเหมือนเดิม (ไว้รายงาน/เทียบ)
--    blended = 0.5 * ค่าดิบ + 0.5 * (rating - 3) / 2 ; ไม่มีดาว = ค่าดิบ (สูตรเดียวกับ blendReviewPolarity ใน src/lib/sentiment.ts)
ALTER TABLE "reviews" ADD COLUMN "blended_polarity" DOUBLE PRECISION;
UPDATE "reviews"
SET "blended_polarity" = CASE
  WHEN "rating" IS NULL THEN "sentiment_polarity"
  ELSE 0.5 * "sentiment_polarity" + 0.5 * ("rating" - 3) / 2.0
END
WHERE "sentiment_polarity" IS NOT NULL;
