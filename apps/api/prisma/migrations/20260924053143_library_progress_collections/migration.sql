-- CreateEnum
CREATE TYPE "LibraryStatus" AS ENUM ('reading', 'up_next', 'completed');

-- AlterTable
ALTER TABLE "user_library" ADD COLUMN     "status" "LibraryStatus" NOT NULL DEFAULT 'up_next';

-- CreateTable
CREATE TABLE "reading_progress" (
    "user_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "last_chapter_id" UUID,
    "last_chapter_number" INTEGER NOT NULL,
    "last_read_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("user_id","novel_id")
);

-- CreateTable
CREATE TABLE "collections" (
    "collection_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "emoji" VARCHAR(16),
    "tint" VARCHAR(20) NOT NULL DEFAULT 'purple',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collections_pkey" PRIMARY KEY ("collection_id")
);

-- CreateTable
CREATE TABLE "collection_items" (
    "collection_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_items_pkey" PRIMARY KEY ("collection_id","novel_id")
);

-- CreateIndex
CREATE INDEX "reading_progress_user_id_last_read_at_idx" ON "reading_progress"("user_id", "last_read_at" DESC);

-- CreateIndex
CREATE INDEX "collections_user_id_position_idx" ON "collections"("user_id", "position");

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_last_chapter_id_fkey" FOREIGN KEY ("last_chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collections" ADD CONSTRAINT "collections_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_collection_id_fkey" FOREIGN KEY ("collection_id") REFERENCES "collections"("collection_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_items" ADD CONSTRAINT "collection_items_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;
