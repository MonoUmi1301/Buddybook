-- CreateEnum
CREATE TYPE "OAuthProvider" AS ENUM ('google', 'facebook', 'line');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "NovelStatus" AS ENUM ('ongoing', 'completed', 'hiatus');

-- CreateEnum
CREATE TYPE "LegalStatus" AS ENUM ('original', 'fan-fiction', 'translation');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('published', 'private', 'pending_review');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('draft', 'published', 'scheduled', 'hidden');

-- CreateEnum
CREATE TYPE "NovelFormat" AS ENUM ('multi_chapter', 'one_shot');

-- CreateEnum
CREATE TYPE "ContentRating" AS ENUM ('all_ages', 'teen', 'mature');

-- CreateEnum
CREATE TYPE "TrashContentType" AS ENUM ('chapter', 'character_node', 'character_edge', 'location', 'location_edge', 'timeline_event');

-- CreateEnum
CREATE TYPE "SentimentLabel" AS ENUM ('pos', 'neg', 'neutral');

-- CreateEnum
CREATE TYPE "CharacterRole" AS ENUM ('protagonist', 'antagonist', 'supporting');

-- CreateEnum
CREATE TYPE "TagCategory" AS ENUM ('genre', 'mood', 'theme', 'pairing', 'fandom', 'freeform');

-- CreateEnum
CREATE TYPE "WalletTxType" AS ENUM ('topup', 'donation_sent', 'donation_received');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('comment', 'reply', 'donation', 'system', 'new_chapter');

-- CreateTable
CREATE TABLE "users" (
    "user_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "pen_name" VARCHAR(50),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "oauth_provider" "OAuthProvider",
    "oauth_id" VARCHAR(255),
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "avatar_url" TEXT,
    "bio" TEXT,
    "age_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_suspended" BOOLEAN NOT NULL DEFAULT false,
    "totp_secret" VARCHAR(255),
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "pending_registrations" (
    "pending_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_registrations_pkey" PRIMARY KEY ("pending_id")
);

-- CreateTable
CREATE TABLE "user_interests" (
    "interest_id" SERIAL NOT NULL,
    "user_id" UUID NOT NULL,
    "tag_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interests_pkey" PRIMARY KEY ("interest_id")
);

-- CreateTable
CREATE TABLE "novels" (
    "novel_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "author_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "cover_image_url" TEXT,
    "synopsis" TEXT,
    "status" "NovelStatus" NOT NULL DEFAULT 'ongoing',
    "legal_status" "LegalStatus" NOT NULL DEFAULT 'original',
    "visibility" "Visibility" NOT NULL DEFAULT 'published',
    "view_count" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),
    "format" "NovelFormat" NOT NULL DEFAULT 'multi_chapter',
    "is_translated" BOOLEAN NOT NULL DEFAULT false,
    "content_rating" "ContentRating" NOT NULL DEFAULT 'all_ages',
    "allow_donations" BOOLEAN NOT NULL DEFAULT true,
    "allow_screenshots" BOOLEAN NOT NULL DEFAULT true,
    "allow_comments" BOOLEAN NOT NULL DEFAULT true,
    "hide_like_count" BOOLEAN NOT NULL DEFAULT false,
    "primary_tag_id" INTEGER,
    "secondary_tag_id" INTEGER,
    "plot_notes" JSONB,
    "theme_notes" JSONB,
    "map_drawings" JSONB,

    CONSTRAINT "novels_pkey" PRIMARY KEY ("novel_id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "chapter_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "chapter_number" INTEGER NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "content" TEXT,
    "status" "ChapterStatus" NOT NULL DEFAULT 'draft',
    "word_count" INTEGER NOT NULL DEFAULT 0,
    "published_at" TIMESTAMPTZ(6),
    "scheduled_publish_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("chapter_id")
);

-- CreateTable
CREATE TABLE "chapter_versions" (
    "version_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chapter_id" UUID NOT NULL,
    "content_snapshot" TEXT NOT NULL,
    "version_number" INTEGER NOT NULL,
    "edited_by" UUID NOT NULL,
    "is_autosave" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_versions_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "trash_bin" (
    "trash_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "content_type" "TrashContentType" NOT NULL,
    "content_ref_id" UUID NOT NULL,
    "content_snapshot" JSONB NOT NULL,
    "deleted_by" UUID NOT NULL,
    "deleted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "auto_delete_at" TIMESTAMPTZ(6) NOT NULL DEFAULT (now() + interval '30 days'),
    "restored_at" TIMESTAMPTZ(6),

    CONSTRAINT "trash_bin_pkey" PRIMARY KEY ("trash_id")
);

-- CreateTable
CREATE TABLE "tags" (
    "tag_id" SERIAL NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "category" "TagCategory",
    "parent_tag_id" INTEGER,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("tag_id")
);

-- CreateTable
CREATE TABLE "novel_tags" (
    "novel_id" UUID NOT NULL,
    "tag_id" INTEGER NOT NULL,

    CONSTRAINT "novel_tags_pkey" PRIMARY KEY ("novel_id","tag_id")
);

-- CreateTable
CREATE TABLE "character_nodes" (
    "node_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "character_name" VARCHAR(100) NOT NULL,
    "avatar_url" TEXT,
    "description" TEXT,
    "character_role" "CharacterRole",
    "node_type" VARCHAR(30) NOT NULL DEFAULT 'characterNode',
    "position_x" DOUBLE PRECISION,
    "position_y" DOUBLE PRECISION,
    "node_style" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6),

    CONSTRAINT "character_nodes_pkey" PRIMARY KEY ("node_id")
);

-- CreateTable
CREATE TABLE "character_edges" (
    "edge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "source_node_id" UUID NOT NULL,
    "target_node_id" UUID NOT NULL,
    "relationship_type" VARCHAR(50),
    "edge_label" VARCHAR(100),
    "description" TEXT,
    "edge_type" VARCHAR(30) NOT NULL DEFAULT 'default',
    "edge_style" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "character_edges_pkey" PRIMARY KEY ("edge_id")
);

-- CreateTable
CREATE TABLE "locations" (
    "location_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "description" TEXT,
    "map_icon_url" TEXT,
    "category" VARCHAR(50),
    "pos_x" DOUBLE PRECISION,
    "pos_y" DOUBLE PRECISION,
    "scale" DOUBLE PRECISION DEFAULT 1,
    "rotation" DOUBLE PRECISION DEFAULT 0,
    "flip_x" BOOLEAN DEFAULT false,
    "z_index" INTEGER DEFAULT 0,
    "linked_chapter_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "locations_pkey" PRIMARY KEY ("location_id")
);

-- CreateTable
CREATE TABLE "map_versions" (
    "version_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "map_versions_pkey" PRIMARY KEY ("version_id")
);

-- CreateTable
CREATE TABLE "location_edges" (
    "edge_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "source_location_id" UUID NOT NULL,
    "target_location_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "location_edges_pkey" PRIMARY KEY ("edge_id")
);

-- CreateTable
CREATE TABLE "timeline_events" (
    "event_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "event_order" INTEGER NOT NULL,
    "event_date_in_story" VARCHAR(50),
    "event_time" VARCHAR(20),
    "thread" VARCHAR(100),
    "color" VARCHAR(20),
    "intensity" INTEGER DEFAULT 5,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timeline_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateTable
CREATE TABLE "comments" (
    "comment_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "chapter_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "parent_comment_id" UUID,
    "content" TEXT NOT NULL,
    "sentiment_label" "SentimentLabel",
    "sentiment_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("comment_id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "review_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "rating" SMALLINT,
    "comment_text" TEXT,
    "sentiment_label" "SentimentLabel",
    "sentiment_score" DOUBLE PRECISION,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("review_id")
);

-- CreateTable
CREATE TABLE "donations" (
    "donation_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "novel_id" UUID,
    "from_user_id" UUID NOT NULL,
    "to_user_id" UUID NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("donation_id")
);

-- CreateTable
CREATE TABLE "wallet_transactions" (
    "transaction_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "WalletTxType" NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "balance_after" DECIMAL(10,2) NOT NULL,
    "reference_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_transactions_pkey" PRIMARY KEY ("transaction_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "link_url" TEXT,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "user_library" (
    "library_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "added_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_library_pkey" PRIMARY KEY ("library_id")
);

-- CreateTable
CREATE TABLE "novel_likes" (
    "like_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "novel_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "novel_likes_pkey" PRIMARY KEY ("like_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_oauth_provider_oauth_id_key" ON "users"("oauth_provider", "oauth_id");

-- CreateIndex
CREATE UNIQUE INDEX "pending_registrations_email_key" ON "pending_registrations"("email");

-- CreateIndex
CREATE UNIQUE INDEX "user_interests_user_id_tag_id_key" ON "user_interests"("user_id", "tag_id");

-- CreateIndex
CREATE INDEX "novels_author_id_idx" ON "novels"("author_id");

-- CreateIndex
CREATE INDEX "novels_status_visibility_idx" ON "novels"("status", "visibility");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_novel_id_chapter_number_key" ON "chapters"("novel_id", "chapter_number");

-- CreateIndex
CREATE INDEX "chapter_versions_chapter_id_created_at_idx" ON "chapter_versions"("chapter_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "chapter_versions_chapter_id_version_number_key" ON "chapter_versions"("chapter_id", "version_number");

-- CreateIndex
CREATE INDEX "trash_bin_auto_delete_at_idx" ON "trash_bin"("auto_delete_at");

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE INDEX "map_versions_novel_id_created_at_idx" ON "map_versions"("novel_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_novel_id_user_id_key" ON "reviews"("novel_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_transactions_type_reference_id_key" ON "wallet_transactions"("type", "reference_id");

-- CreateIndex
CREATE INDEX "user_library_user_id_added_at_idx" ON "user_library"("user_id", "added_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "user_library_user_id_novel_id_key" ON "user_library"("user_id", "novel_id");

-- CreateIndex
CREATE INDEX "novel_likes_novel_id_idx" ON "novel_likes"("novel_id");

-- CreateIndex
CREATE UNIQUE INDEX "novel_likes_user_id_novel_id_key" ON "novel_likes"("user_id", "novel_id");

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interests" ADD CONSTRAINT "user_interests_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("tag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_primary_tag_id_fkey" FOREIGN KEY ("primary_tag_id") REFERENCES "tags"("tag_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novels" ADD CONSTRAINT "novels_secondary_tag_id_fkey" FOREIGN KEY ("secondary_tag_id") REFERENCES "tags"("tag_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapter_versions" ADD CONSTRAINT "chapter_versions_edited_by_fkey" FOREIGN KEY ("edited_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trash_bin" ADD CONSTRAINT "trash_bin_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trash_bin" ADD CONSTRAINT "trash_bin_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_parent_tag_id_fkey" FOREIGN KEY ("parent_tag_id") REFERENCES "tags"("tag_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_tags" ADD CONSTRAINT "novel_tags_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_tags" ADD CONSTRAINT "novel_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags"("tag_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_nodes" ADD CONSTRAINT "character_nodes_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_edges" ADD CONSTRAINT "character_edges_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_edges" ADD CONSTRAINT "character_edges_source_node_id_fkey" FOREIGN KEY ("source_node_id") REFERENCES "character_nodes"("node_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "character_edges" ADD CONSTRAINT "character_edges_target_node_id_fkey" FOREIGN KEY ("target_node_id") REFERENCES "character_nodes"("node_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "locations" ADD CONSTRAINT "locations_linked_chapter_id_fkey" FOREIGN KEY ("linked_chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "map_versions" ADD CONSTRAINT "map_versions_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_edges" ADD CONSTRAINT "location_edges_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_edges" ADD CONSTRAINT "location_edges_source_location_id_fkey" FOREIGN KEY ("source_location_id") REFERENCES "locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "location_edges" ADD CONSTRAINT "location_edges_target_location_id_fkey" FOREIGN KEY ("target_location_id") REFERENCES "locations"("location_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "timeline_events" ADD CONSTRAINT "timeline_events_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("chapter_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_fkey" FOREIGN KEY ("parent_comment_id") REFERENCES "comments"("comment_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_library" ADD CONSTRAINT "user_library_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_likes" ADD CONSTRAINT "novel_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "novel_likes" ADD CONSTRAINT "novel_likes_novel_id_fkey" FOREIGN KEY ("novel_id") REFERENCES "novels"("novel_id") ON DELETE CASCADE ON UPDATE CASCADE;

