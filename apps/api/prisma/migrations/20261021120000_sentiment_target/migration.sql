-- ป้ายเป้าหมายของความรู้สึก (ตัวละคร / อินกับเรื่อง / งานเขียน) ที่ NLP worker ติดให้ — ไม่เปลี่ยน sentiment_label
CREATE TYPE "SentimentTarget" AS ENUM ('character', 'immersion', 'work');

ALTER TABLE "comments" ADD COLUMN "sentiment_target" "SentimentTarget";
ALTER TABLE "reviews" ADD COLUMN "sentiment_target" "SentimentTarget";
