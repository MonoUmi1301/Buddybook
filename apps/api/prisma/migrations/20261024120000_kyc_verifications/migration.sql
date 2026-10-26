-- e-KYC (บัตร + Liveness) — เก็บเฉพาะสถานะ/หลักฐานความยินยอม/hash เลขเอกสาร ไม่เก็บรูปหรือเลขบัตร
CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "kyc_verifications" (
    "verification_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "external_ref" UUID NOT NULL DEFAULT gen_random_uuid(),
    "provider" VARCHAR(20) NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "consent_version" VARCHAR(20) NOT NULL,
    "consented_at" TIMESTAMPTZ(6) NOT NULL,
    "document_type" VARCHAR(20),
    "document_country" CHAR(3),
    "id_number_hash" CHAR(64),
    "reject_reason" VARCHAR(40),
    "retry_allowed" BOOLEAN NOT NULL DEFAULT true,
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kyc_verifications_pkey" PRIMARY KEY ("verification_id")
);

CREATE UNIQUE INDEX "kyc_verifications_external_ref_key" ON "kyc_verifications"("external_ref");
CREATE INDEX "kyc_verifications_user_id_created_at_idx" ON "kyc_verifications"("user_id", "created_at");
CREATE INDEX "kyc_verifications_id_number_hash_idx" ON "kyc_verifications"("id_number_hash");

ALTER TABLE "kyc_verifications" ADD CONSTRAINT "kyc_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
