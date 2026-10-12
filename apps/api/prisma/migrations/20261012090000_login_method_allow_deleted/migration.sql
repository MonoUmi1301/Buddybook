-- users: บัญชีที่ถูกลบผ่าน DELETE /users/me ถูก anonymize ให้ password_hash และ oauth_* เป็น NULL
-- พร้อมกันโดยตั้งใจ (ดู deleteMe ใน users.controller.ts) — chk_users_has_login_method เดิมทำให้การลบบัญชีชน
-- constraint ทุกครั้ง จึงยกเว้นแถวที่ email เป็นรูปแบบของบัญชีที่ถูกลบแล้ว
ALTER TABLE "users" DROP CONSTRAINT IF EXISTS chk_users_has_login_method;
ALTER TABLE "users"
  ADD CONSTRAINT chk_users_has_login_method
  CHECK (
    password_hash IS NOT NULL
    OR oauth_provider IS NOT NULL
    OR email LIKE 'deleted+%@buddybook.invalid'
  );
