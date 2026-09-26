-- เพิ่มภายหลัง (perf/safety) — กันธุรกรรมค้างล็อกแถว/advisory lock ไว้ไม่รู้จบ (ตั้งที่ระดับ database มีผลกับ
-- connection ใหม่ทุกตัว connection ที่เปิดค้างอยู่ได้ค่าใหม่ตอนต่อใหม่)
-- - idle_in_transaction_session_timeout: session ที่เปิด transaction แล้วเงียบเกิน 60 วิ ถูกตัด (ปลดล็อกทั้งหมด)
-- - lock_timeout: รอ lock (รวม pg_advisory_xact_lock ของกระเป๋าเงิน) เกิน 10 วิ = error แทนค้าง
-- ตั้งใจไม่ตั้ง statement_timeout ทั้ง database เพราะจะกระทบ migration/งานบำรุงรักษาที่ใช้เวลานาน
-- ธุรกรรมของแอปมี timeout ของ Prisma ($transaction) คุมอยู่แล้ว (ดู WALLET_TX_OPTIONS ใน wallet.service.ts)
-- ต้องรันด้วย user ที่เป็นเจ้าของ database (หรือ superuser)
DO $$
BEGIN
  EXECUTE format('ALTER DATABASE %I SET idle_in_transaction_session_timeout = %L', current_database(), '60s');
  EXECUTE format('ALTER DATABASE %I SET lock_timeout = %L', current_database(), '10s');
END
$$;
