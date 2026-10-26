-- LINE login: อีเมลเป็น null ได้ (ยัง unique) + คอลัมน์ LINE user id + ตาราง OTP ยืนยันอีเมลของบัญชีที่ยังไม่มีอีเมล
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD COLUMN "line_user_id" VARCHAR(64);
CREATE UNIQUE INDEX "users_line_user_id_key" ON "users"("line_user_id");

-- บัญชีที่ล็อกอินด้วย LINE อยู่แล้ว — ย้าย sub มาไว้ในคอลัมน์ใหม่ (อีเมลปลอม line_<sub>@... ล้างด้วย npm run db:line-emails)
UPDATE "users" SET "line_user_id" = "oauth_id"
WHERE "oauth_provider" = 'line' AND "oauth_id" IS NOT NULL AND "line_user_id" IS NULL;

CREATE TABLE "pending_email_verifications" (
    "user_id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "otp_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pending_email_verifications_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "pending_email_verifications" ADD CONSTRAINT "pending_email_verifications_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;
