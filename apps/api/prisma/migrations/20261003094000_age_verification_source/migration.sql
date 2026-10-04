-- gap 3.4 — แหล่งที่ยืนยันอายุ (google / self_declared)
ALTER TABLE "users" ADD COLUMN "age_verification_source" VARCHAR(20);
