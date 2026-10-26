-- e-KYC ย้ายจาก Sumsub ไป Didit — เก็บ session_id ของผู้ให้บริการไว้ดึงผล/สั่งลบข้อมูลฝั่งผู้ให้บริการ
-- (Didit อ้าง session ด้วย session_id ไม่ใช่ externalUserId แบบ Sumsub)
ALTER TABLE "kyc_verifications" ADD COLUMN "provider_session_id" VARCHAR(64);
CREATE UNIQUE INDEX "kyc_verifications_provider_session_id_key" ON "kyc_verifications"("provider_session_id");
