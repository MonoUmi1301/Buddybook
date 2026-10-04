-- gap 2.1 — sentiment_score เดิมคือความมั่นใจของ label ที่โมเดลทาย (0..1) ไม่ใช่ขั้วความรู้สึก
-- รีวิวที่ติแรง (neg, 0.98) จึงถูกระบบแนะนำนับเป็น "ชอบมาก" — เพิ่มคอลัมน์ขั้ว −1..1 แยกต่างหาก
-- (คง sentiment_score ไว้เพื่อไม่ให้ API/worker เดิมพัง) แล้วคำนวณย้อนหลังจาก label+score ที่มีอยู่

ALTER TABLE "comments" ADD COLUMN "sentiment_polarity" DOUBLE PRECISION;
ALTER TABLE "reviews" ADD COLUMN "sentiment_polarity" DOUBLE PRECISION;

UPDATE "comments" SET "sentiment_polarity" = CASE "sentiment_label"
    WHEN 'pos' THEN COALESCE("sentiment_score", 1)
    WHEN 'neg' THEN -COALESCE("sentiment_score", 1)
    ELSE 0 END
  WHERE "sentiment_label" IS NOT NULL;

UPDATE "reviews" SET "sentiment_polarity" = CASE "sentiment_label"
    WHEN 'pos' THEN COALESCE("sentiment_score", 1)
    WHEN 'neg' THEN -COALESCE("sentiment_score", 1)
    ELSE 0 END
  WHERE "sentiment_label" IS NOT NULL;

ALTER TABLE "comments" ADD CONSTRAINT chk_comments_sentiment_polarity_range
  CHECK ("sentiment_polarity" IS NULL OR ("sentiment_polarity" >= -1 AND "sentiment_polarity" <= 1));
ALTER TABLE "reviews" ADD CONSTRAINT chk_reviews_sentiment_polarity_range
  CHECK ("sentiment_polarity" IS NULL OR ("sentiment_polarity" >= -1 AND "sentiment_polarity" <= 1));
