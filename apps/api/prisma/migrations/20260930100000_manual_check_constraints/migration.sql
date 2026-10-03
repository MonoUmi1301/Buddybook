-- ============================================================================
-- BuddyBook — CHECK constraints ที่ Prisma schema.prisma แสดงไม่ได้แบบ declarative
-- เดิมอยู่ที่ prisma/migrations_manual/checks.sql (ต้องรันเองหลัง migrate) ย้ายมาเป็น migration
-- ให้ migrate reset / deploy / CI ได้ครบอัตโนมัติ — DROP IF EXISTS ก่อน ADD ทุกตัว รันซ้ำบนฐานที่มีอยู่แล้วได้
-- Prisma ไม่ติดตาม CHECK constraint จึงไม่นับเป็น drift
-- อ้างอิงจาก BuddyBook_Data_Dictionary_and_Schema.md ทุกข้อ
-- ============================================================================

-- users: กันบัญชีที่ login ไม่ได้เลย (ไม่มีทั้ง password และ OAuth)
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS chk_users_has_login_method;
ALTER TABLE "users"
  ADD CONSTRAINT chk_users_has_login_method
  CHECK (password_hash IS NOT NULL OR oauth_provider IS NOT NULL);

-- trash_bin: auto_delete_at ต้องอยู่หลัง deleted_at เสมอ
ALTER TABLE "trash_bin" DROP CONSTRAINT IF EXISTS chk_trash_bin_auto_delete_after_deleted;
ALTER TABLE "trash_bin"
  ADD CONSTRAINT chk_trash_bin_auto_delete_after_deleted
  CHECK (auto_delete_at > deleted_at);

-- comments: sentiment_score ต้องอยู่ในช่วง 0-1 (ถ้าไม่ NULL)
ALTER TABLE "comments" DROP CONSTRAINT IF EXISTS chk_comments_sentiment_score_range;
ALTER TABLE "comments"
  ADD CONSTRAINT chk_comments_sentiment_score_range
  CHECK (sentiment_score IS NULL OR (sentiment_score >= 0 AND sentiment_score <= 1));

-- reviews: rating ต้องอยู่ในช่วง 1-5, sentiment_score 0-1
ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS chk_reviews_rating_range;
ALTER TABLE "reviews"
  ADD CONSTRAINT chk_reviews_rating_range
  CHECK (rating IS NULL OR (rating >= 1 AND rating <= 5));

ALTER TABLE "reviews" DROP CONSTRAINT IF EXISTS chk_reviews_sentiment_score_range;
ALTER TABLE "reviews"
  ADD CONSTRAINT chk_reviews_sentiment_score_range
  CHECK (sentiment_score IS NULL OR (sentiment_score >= 0 AND sentiment_score <= 1));

-- character_edges: กันตัวละครลากเส้นหาตัวเอง
ALTER TABLE "character_edges" DROP CONSTRAINT IF EXISTS chk_character_edges_no_self_loop;
ALTER TABLE "character_edges"
  ADD CONSTRAINT chk_character_edges_no_self_loop
  CHECK (source_node_id <> target_node_id);

-- donations: จำนวนเงินต้องมากกว่า 0
ALTER TABLE "donations" DROP CONSTRAINT IF EXISTS chk_donations_amount_positive;
ALTER TABLE "donations"
  ADD CONSTRAINT chk_donations_amount_positive
  CHECK (amount > 0);
-- donations (Gift donations): จำนวนชิ้น 1-99, ยอดสุทธิ + ค่าธรรมเนียม = ยอดที่หักจากผู้ให้เสมอ
ALTER TABLE "donations" DROP CONSTRAINT IF EXISTS chk_donations_quantity_range;
ALTER TABLE "donations"
  ADD CONSTRAINT chk_donations_quantity_range
  CHECK (quantity >= 1 AND quantity <= 99);

ALTER TABLE "donations" DROP CONSTRAINT IF EXISTS chk_donations_fee_split;
ALTER TABLE "donations"
  ADD CONSTRAINT chk_donations_fee_split
  CHECK (fee_amount >= 0 AND net_amount >= 0 AND net_amount + fee_amount = amount);

-- gift_items: ราคาต้องมากกว่า 0 และช่วงเวลาขาย (ถ้ามี) ต้องไม่กลับด้าน
ALTER TABLE "gift_items" DROP CONSTRAINT IF EXISTS chk_gift_items_price_positive;
ALTER TABLE "gift_items"
  ADD CONSTRAINT chk_gift_items_price_positive
  CHECK (price_coins > 0);

ALTER TABLE "gift_items" DROP CONSTRAINT IF EXISTS chk_gift_items_window;
ALTER TABLE "gift_items"
  ADD CONSTRAINT chk_gift_items_window
  CHECK (available_from IS NULL OR available_to IS NULL OR available_from < available_to);
