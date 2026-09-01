-- ============================================================================
-- BuddyBook — CHECK constraints ที่ Prisma schema.prisma แสดงไม่ได้แบบ declarative
-- รันไฟล์นี้ "หลัง" จาก `prisma migrate dev` ครั้งแรก (หรือใส่เป็น migration.sql เพิ่มเติม)
-- อ้างอิงจาก BuddyBook_Data_Dictionary_and_Schema.md ทุกข้อ
-- ============================================================================

-- users: กันบัญชีที่ login ไม่ได้เลย (ไม่มีทั้ง password และ OAuth)
ALTER TABLE "users"
  ADD CONSTRAINT chk_users_has_login_method
  CHECK (password_hash IS NOT NULL OR oauth_provider IS NOT NULL);

-- trash_bin: auto_delete_at ต้องอยู่หลัง deleted_at เสมอ
ALTER TABLE "trash_bin"
  ADD CONSTRAINT chk_trash_bin_auto_delete_after_deleted
  CHECK (auto_delete_at > deleted_at);

-- comments: sentiment_score ต้องอยู่ในช่วง 0-1 (ถ้าไม่ NULL)
ALTER TABLE "comments"
  ADD CONSTRAINT chk_comments_sentiment_score_range
  CHECK (sentiment_score IS NULL OR (sentiment_score >= 0 AND sentiment_score <= 1));

-- reviews: rating ต้องอยู่ในช่วง 1-5, sentiment_score 0-1
ALTER TABLE "reviews"
  ADD CONSTRAINT chk_reviews_rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE "reviews"
  ADD CONSTRAINT chk_reviews_sentiment_score_range
  CHECK (sentiment_score IS NULL OR (sentiment_score >= 0 AND sentiment_score <= 1));

-- character_edges: กันตัวละครลากเส้นหาตัวเอง
ALTER TABLE "character_edges"
  ADD CONSTRAINT chk_character_edges_no_self_loop
  CHECK (source_node_id <> target_node_id);

-- donations: จำนวนเงินต้องมากกว่า 0
ALTER TABLE "donations"
  ADD CONSTRAINT chk_donations_amount_positive
  CHECK (amount > 0);
