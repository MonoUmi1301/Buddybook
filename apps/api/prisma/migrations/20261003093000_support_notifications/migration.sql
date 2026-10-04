-- gap 3.2 ระบบแจ้งปัญหา/ซัพพอร์ต + gap 3.3 ปิดการแจ้งเตือนรายประเภท
-- CreateEnum
CREATE TYPE "SupportCategory" AS ENUM ('account', 'payment', 'bug', 'content', 'other');

-- CreateEnum
CREATE TYPE "SupportStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'support_reply';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "muted_notification_types" "NotificationType"[] DEFAULT ARRAY[]::"NotificationType"[];

-- CreateTable
CREATE TABLE "support_tickets" (
    "ticket_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "category" "SupportCategory" NOT NULL,
    "subject" VARCHAR(150) NOT NULL,
    "status" "SupportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("ticket_id")
);

-- CreateTable
CREATE TABLE "support_messages" (
    "message_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticket_id" UUID NOT NULL,
    "author_id" UUID NOT NULL,
    "is_staff" BOOLEAN NOT NULL DEFAULT false,
    "body" TEXT NOT NULL,
    "attachment_url" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "support_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "support_tickets_user_id_updated_at_idx" ON "support_tickets"("user_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "support_tickets_status_updated_at_idx" ON "support_tickets"("status", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "support_messages_ticket_id_created_at_idx" ON "support_messages"("ticket_id", "created_at");

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "support_tickets"("ticket_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "support_messages" ADD CONSTRAINT "support_messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

