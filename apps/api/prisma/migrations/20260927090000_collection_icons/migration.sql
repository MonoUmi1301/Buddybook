-- เลิกใช้อีโมจิเป็นไอคอนชั้นหนังสือ — เปลี่ยนเป็น key ของไอคอนชุดคงที่ (ดู COLLECTION_ICONS ใน collections.service.ts)
-- อีโมจิเดิมที่มีคู่ตรงถูกแปลงเป็น key, ที่เหลือ (อีโมจิที่ผู้ใช้พิมพ์เอง) กลายเป็นไม่มีไอคอน
-- ใช้ unicode escape ของ Postgres แทนตัวอีโมจิจริง (ตัด variation selector U+FE0F ออกก่อนเทียบ)

-- AlterTable
ALTER TABLE "collections" ADD COLUMN "icon" VARCHAR(30);

UPDATE "collections"
SET "icon" = CASE replace("emoji", U&'\FE0F', '')
  WHEN U&'\+01F4DA' THEN 'books'
  WHEN U&'\+01F4D6' THEN 'books'
  WHEN U&'\+01F496' THEN 'heart'
  WHEN U&'\2764' THEN 'heart'
  WHEN U&'\2B50' THEN 'star'
  WHEN U&'\+01F319' THEN 'moon'
  WHEN U&'\2600' THEN 'sun'
  WHEN U&'\2615' THEN 'coffee'
  WHEN U&'\+01F30A' THEN 'waves'
  WHEN U&'\+01F343' THEN 'leaf'
  WHEN U&'\+01F525' THEN 'flame'
  WHEN U&'\+01F47B' THEN 'ghost'
  WHEN U&'\2694' THEN 'swords'
  WHEN U&'\2728' THEN 'sparkles'
  WHEN U&'\+01FAB6' THEN 'feather'
  WHEN U&'\+01F3B5' THEN 'music'
  ELSE NULL
END
WHERE "emoji" IS NOT NULL;

ALTER TABLE "collections" DROP COLUMN "emoji";
