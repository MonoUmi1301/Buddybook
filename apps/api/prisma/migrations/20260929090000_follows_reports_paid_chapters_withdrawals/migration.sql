-- เพิ่มภายหลัง — ติดตามนักเขียน (author_follows), รายงานเนื้อหา (content_reports),
-- ตอนติดเหรียญ (chapters.price_coins + chapter_purchases), ถอนรายได้นักเขียน (withdrawal_requests)

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('novel', 'chapter', 'comment', 'review', 'user');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('spam', 'harassment', 'inappropriate', 'copyright', 'other');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'dismissed', 'actioned');

-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('pending', 'paid', 'rejected');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'new_follower';

-- AlterEnum
ALTER TYPE "WalletTxType" ADD VALUE 'chapter_purchase';
ALTER TYPE "WalletTxType" ADD VALUE 'chapter_sale';
ALTER TYPE "WalletTxType" ADD VALUE 'withdrawal';
ALTER TYPE "WalletTxType" ADD VALUE 'withdrawal_refund';

-- AlterTable
ALTER TABLE "chapters" ADD COLUMN     "price_coins" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "author_follows" (
    "follower_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_follows_pkey" PRIMARY KEY ("follower_id","author_id")
);

-- CreateTable
CREATE TABLE "content_reports" (
    "report_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporter_id" UUID NOT NULL,
    "target_type" "ReportTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "admin_note" VARCHAR(500),
    "resolved_by" UUID,
    "resolved_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_reports_pkey" PRIMARY KEY ("report_id")
);

-- CreateTable
CREATE TABLE "chapter_purchases" (
    "purchase_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "price_coins" INTEGER NOT NULL,
    "fee_coins" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_purchases_pkey" PRIMARY KEY ("purchase_id")
);

-- CreateTable
CREATE TABLE "withdrawal_requests" (
    "withdrawal_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "amount_coins" INTEGER NOT NULL,
    "amount_thb" DECIMAL(10,2) NOT NULL,
    "payout_method" VARCHAR(20) NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "account_number" VARCHAR(50) NOT NULL,
    "bank_name" VARCHAR(100),
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'pending',
    "admin_note" VARCHAR(500),
    "processed_by" UUID,
    "processed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "withdrawal_requests_pkey" PRIMARY KEY ("withdrawal_id")
);

-- CreateIndex
CREATE INDEX "author_follows_author_id_idx" ON "author_follows"("author_id");

-- CreateIndex
CREATE INDEX "content_reports_status_created_at_idx" ON "content_reports"("status", "created_at");

-- CreateIndex
CREATE INDEX "content_reports_target_type_target_id_idx" ON "content_reports"("target_type", "target_id");

-- CreateIndex
CREATE UNIQUE INDEX "content_reports_reporter_id_target_type_target_id_key" ON "content_reports"("reporter_id", "target_type", "target_id");

-- CreateIndex
CREATE INDEX "chapter_purchases_chapter_id_idx" ON "chapter_purchases"("chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_purchases_user_id_chapter_id_key" ON "chapter_purchases"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "withdrawal_requests_user_id_created_at_idx" ON "withdrawal_requests"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "withdrawal_requests_status_created_at_idx" ON "withdrawal_requests"("status", "created_at");

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_reports" ADD CONSTRAINT "content_reports_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_purchases" ADD CONSTRAINT "chapter_purchases_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_purchases" ADD CONSTRAINT "chapter_purchases_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_fkey" FOREIGN KEY ("processed_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CHECK constraints (Prisma ประกาศแบบ declarative ไม่ได้)
ALTER TABLE "chapters" ADD CONSTRAINT "chk_chapters_price_coins_range" CHECK ("price_coins" BETWEEN 0 AND 1000);
ALTER TABLE "author_follows" ADD CONSTRAINT "chk_author_follows_not_self" CHECK ("follower_id" <> "author_id");
ALTER TABLE "chapter_purchases" ADD CONSTRAINT "chk_chapter_purchases_price" CHECK ("price_coins" > 0 AND "fee_coins" >= 0 AND "fee_coins" <= "price_coins");
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "chk_withdrawal_amounts" CHECK ("amount_coins" > 0 AND "amount_thb" > 0);
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "chk_withdrawal_payout_method" CHECK ("payout_method" IN ('promptpay', 'bank'));
