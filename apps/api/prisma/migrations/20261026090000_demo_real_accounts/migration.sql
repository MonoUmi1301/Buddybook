-- แยกข้อมูลตัวอย่าง (DEMO) ออกจากผู้ใช้จริง (REAL) — เพิ่มคอลัมน์อย่างเดียว ไม่ลบ/แก้ข้อมูลเดิม
-- แถวเดิมทั้งหมดได้ค่า default (REAL / false) ก่อน แล้วค่อยติดป้ายด้วย scripts/mark-demo.ts

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('DEMO', 'REAL');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "account_type" "AccountType" NOT NULL DEFAULT 'REAL';
ALTER TABLE "novels" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chapters" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "comments" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "reviews" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "donations" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "novel_likes" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "chapter_purchases" ADD COLUMN "is_demo" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "users_account_type_idx" ON "users"("account_type");
CREATE INDEX "novels_is_demo_idx" ON "novels"("is_demo");
CREATE INDEX "reviews_is_demo_idx" ON "reviews"("is_demo");
