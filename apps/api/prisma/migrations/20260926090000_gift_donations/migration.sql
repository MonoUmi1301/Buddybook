-- CreateEnum
CREATE TYPE "GiftTier" AS ENUM ('S', 'M', 'L', 'XL');

-- CreateEnum
CREATE TYPE "GiftAnimation" AS ENUM ('none', 'pop', 'float', 'sparkle');

-- CreateEnum
CREATE TYPE "GiftCardTemplate" AS ENUM ('stamp', 'matcha', 'navy', 'bear');

-- AlterTable
ALTER TABLE "donations" ADD COLUMN     "card_template" "GiftCardTemplate",
ADD COLUMN     "chapter_id" UUID,
ADD COLUMN     "fee_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "gift_id" UUID,
ADD COLUMN     "hidden_at" TIMESTAMPTZ(6),
ADD COLUMN     "idempotency_key" VARCHAR(64),
ADD COLUMN     "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_public" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "net_amount" DECIMAL(10,2),
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "read_at" TIMESTAMPTZ(6),
ADD COLUMN     "report_reason" VARCHAR(200),
ADD COLUMN     "report_resolved_at" TIMESTAMPTZ(6),
ADD COLUMN     "reported_at" TIMESTAMPTZ(6),
ADD COLUMN     "signature_name" VARCHAR(50),
ADD COLUMN     "thank_message" VARCHAR(200),
ADD COLUMN     "thanked_at" TIMESTAMPTZ(6),
ADD COLUMN     "unit_price_coins" INTEGER;

-- Backfill: โดเนทเดิมไม่มีค่าธรรมเนียม ผู้รับได้เต็มจำนวน
UPDATE "donations" SET "net_amount" = "amount" WHERE "net_amount" IS NULL;
ALTER TABLE "donations" ALTER COLUMN "net_amount" SET NOT NULL;

-- CreateTable
CREATE TABLE "gift_items" (
    "gift_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(50) NOT NULL,
    "name_th" VARCHAR(100) NOT NULL,
    "name_en" VARCHAR(100) NOT NULL,
    "description_th" TEXT,
    "price_coins" INTEGER NOT NULL,
    "tier" "GiftTier" NOT NULL,
    "image_url" TEXT NOT NULL,
    "animation" "GiftAnimation" NOT NULL DEFAULT 'none',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_limited" BOOLEAN NOT NULL DEFAULT false,
    "available_from" TIMESTAMPTZ(6),
    "available_to" TIMESTAMPTZ(6),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "gift_items_pkey" PRIMARY KEY ("gift_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "gift_items_slug_key" ON "gift_items"("slug");

-- CreateIndex
CREATE INDEX "donations_to_user_id_created_at_idx" ON "donations"("to_user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "donations_from_user_id_created_at_idx" ON "donations"("from_user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "donations_from_user_id_idempotency_key_key" ON "donations"("from_user_id", "idempotency_key");

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_gift_id_fkey" FOREIGN KEY ("gift_id") REFERENCES "gift_items"("gift_id") ON DELETE RESTRICT ON UPDATE CASCADE;

