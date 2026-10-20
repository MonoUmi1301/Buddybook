-- เก็บกวาดข้อมูลเก่า — ก่อนหน้านี้การลบบัญชี (DELETE /users/me) เปลี่ยนแค่ชื่อเป็น "ผู้ใช้ที่ถูกลบ_..."
-- แต่นิยายของบัญชีนั้นยังเผยแพร่อยู่ ย้ายนิยายของบัญชีที่ถูกลบไปแล้วทั้งหมดลงถังขยะ (เหมือน deleteNovel)
-- บัญชีที่ถูกลบระบุจากอีเมลที่ deleteMe ตั้งให้: deleted+<user_id>@buddybook.invalid
UPDATE "novels" AS n
SET "visibility_before_delete" = n."visibility",
    "visibility" = 'private',
    "deleted_at" = NOW(),
    "updated_at" = NOW()
FROM "users" AS u
WHERE n."author_id" = u."user_id"
  AND (u."email" LIKE 'deleted+%@buddybook.invalid' OR u."username" LIKE 'ผู้ใช้ที่ถูกลบ\_%')
  AND n."deleted_at" IS NULL;
