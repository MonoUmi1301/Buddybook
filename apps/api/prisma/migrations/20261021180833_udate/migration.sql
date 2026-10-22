-- AlterTable
ALTER TABLE "trash_bin" ALTER COLUMN "auto_delete_at" SET DEFAULT (now() + interval '30 days');
