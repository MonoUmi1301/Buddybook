-- บัญชีที่ผู้ใช้ลบเอง (DELETE /users/me) — เขียนให้รันซ้ำได้ (IF NOT EXISTS / DROP IF EXISTS)
--
-- 1) ระบุบัญชีที่ถูกลบด้วยคอลัมน์จริง: เดิมใช้ "password_hash กับ oauth ว่างทั้งคู่" เป็นเครื่องหมาย ซึ่งขัดกับ
--    chk_users_has_login_method (20260930100000) ทำให้ DELETE /users/me ล้มด้วย 500 ทุกครั้งบนฐานข้อมูลที่มี constraint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);

-- บัญชีที่ถูก anonymize ไปแล้วก่อนหน้านี้ (อีเมลที่ระบบแทนให้ตอนลบ)
UPDATE "users"
   SET "deleted_at" = COALESCE("updated_at", now())
 WHERE "deleted_at" IS NULL
   AND "email" LIKE 'deleted+%@buddybook.invalid';

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS chk_users_has_login_method;
ALTER TABLE "users"
  ADD CONSTRAINT chk_users_has_login_method
  CHECK (password_hash IS NOT NULL OR oauth_provider IS NOT NULL OR deleted_at IS NOT NULL);

-- 2) นิยายของบัญชีที่ถูกลบยังเผยแพร่อยู่ในชื่อ "ผู้ใช้ที่ถูกลบ_xxx" — ย้ายลงถังขยะแบบเดียวกับที่ DELETE /users/me
--    ทำตอนนี้: ซ่อนทันที (private) แล้ว scheduler purge ลบถาวรเมื่อครบ 30 วัน (เรื่องที่มีคนซื้อตอนไว้ถูกซ่อนแต่ไม่ purge)
UPDATE "novels" n
   SET "visibility_before_delete" = n."visibility",
       "visibility" = 'private',
       "deleted_at" = now(),
       "updated_at" = now()
  FROM "users" u
 WHERE n."author_id" = u."user_id"
   AND n."deleted_at" IS NULL
   AND u."deleted_at" IS NOT NULL;
