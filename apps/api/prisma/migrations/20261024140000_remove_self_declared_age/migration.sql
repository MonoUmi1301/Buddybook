-- ยกเลิกการยืนยันอายุแบบกรอกวันเกิดเอง (ไม่มีหลักฐาน) — ยอมรับเฉพาะ e-KYC และ Google
-- ลบอายุที่ได้จากการกรอกเอง/ไม่ทราบแหล่ง (PDPA data minimization: ไม่ใช้แล้วก็ไม่เก็บ)
UPDATE "users"
   SET "birth_date" = NULL, "age_verified" = false, "age_verification_source" = NULL, "updated_at" = now()
 WHERE "age_verification_source" IS DISTINCT FROM 'kyc'
   AND "age_verification_source" IS DISTINCT FROM 'google'
   AND ("age_verification_source" IS NOT NULL OR "age_verified" OR "birth_date" IS NOT NULL);

-- กันค่าแหล่งอื่นกลับเข้ามา
ALTER TABLE "users" ADD CONSTRAINT "chk_users_age_verification_source"
  CHECK ("age_verification_source" IS NULL OR "age_verification_source" IN ('kyc', 'google'));
