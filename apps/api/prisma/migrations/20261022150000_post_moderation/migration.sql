-- Post-moderation: novels go live as soon as the writer publishes them; admins audit
-- published novels afterwards and can suspend them (with a reason) — writers can appeal.

-- CreateEnum
CREATE TYPE "ModerationCaseStatus" AS ENUM ('suspended', 'appeal_pending', 'reinstated', 'upheld');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'moderation';

-- The pre-moderation queue is gone: anything still waiting there was meant to be public,
-- so it goes live now (same as a writer pressing "publish" under the new model).
UPDATE "novels" SET "visibility" = 'published' WHERE "visibility" = 'pending_review';
UPDATE "novels" SET "visibility_before_delete" = 'published' WHERE "visibility_before_delete" = 'pending_review';

-- AlterEnum: pending_review → suspended
BEGIN;
CREATE TYPE "Visibility_new" AS ENUM ('published', 'private', 'suspended');
ALTER TABLE "novels" ALTER COLUMN "visibility" DROP DEFAULT;
ALTER TABLE "novels" ALTER COLUMN "visibility" TYPE "Visibility_new" USING ("visibility"::text::"Visibility_new");
ALTER TABLE "novels" ALTER COLUMN "visibility_before_delete" TYPE "Visibility_new" USING ("visibility_before_delete"::text::"Visibility_new");
ALTER TYPE "Visibility" RENAME TO "Visibility_old";
ALTER TYPE "Visibility_new" RENAME TO "Visibility";
DROP TYPE "Visibility_old";
ALTER TABLE "novels" ALTER COLUMN "visibility" SET DEFAULT 'published';
COMMIT;

-- AlterTable
ALTER TABLE "novels" ADD COLUMN "moderation_reviewed_at" TIMESTAMPTZ(6);

-- CreateTable
CREATE TABLE "novel_moderation_cases" (
    "case_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "status" "ModerationCaseStatus" NOT NULL DEFAULT 'suspended',
    "reason" TEXT NOT NULL,
    "visibility_before_suspend" "Visibility" NOT NULL,
    "suspended_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appeal_message" TEXT,
    "appealed_at" TIMESTAMPTZ(6),
    "appeal_count" INTEGER NOT NULL DEFAULT 0,
    "resolved_by" UUID,
    "resolution_note" TEXT,
    "resolved_at" TIMESTAMPTZ(6),

    CONSTRAINT "novel_moderation_cases_pkey" PRIMARY KEY ("case_id")
);

-- CreateIndex
CREATE INDEX "novel_moderation_cases_novel_id_created_at_idx" ON "novel_moderation_cases"("novel_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "novel_moderation_cases_status_appealed_at_idx" ON "novel_moderation_cases"("status", "appealed_at");

-- AddForeignKey
ALTER TABLE "novel_moderation_cases" ADD CONSTRAINT "novel_moderation_cases_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_moderation_cases" ADD CONSTRAINT "novel_moderation_cases_suspended_by_fkey" FOREIGN KEY ("suspended_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_moderation_cases" ADD CONSTRAINT "novel_moderation_cases_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
