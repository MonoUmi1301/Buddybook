-- CreateEnum
CREATE TYPE "TopupOrderStatus" AS ENUM ('pending', 'paid', 'failed');

-- CreateTable
CREATE TABLE "topup_orders" (
    "order_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "stripe_session_id" VARCHAR(255) NOT NULL,
    "package_id" VARCHAR(20) NOT NULL,
    "coins" INTEGER NOT NULL,
    "amount_thb" DECIMAL(10,2) NOT NULL,
    "status" "TopupOrderStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "paid_at" TIMESTAMPTZ(6),
    "failed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "topup_orders_pkey" PRIMARY KEY ("order_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "topup_orders_stripe_session_id_key" ON "topup_orders"("stripe_session_id");

-- CreateIndex
CREATE INDEX "topup_orders_user_id_created_at_idx" ON "topup_orders"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "topup_orders" ADD CONSTRAINT "topup_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
