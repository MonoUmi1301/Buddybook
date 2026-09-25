-- รันครั้งเดียวตอน volume pgdata ถูกสร้างใหม่ (docker-entrypoint-initdb.d) — schema.prisma ใช้
-- gen_random_uuid() เป็น default ของทุก primary key uuid
CREATE EXTENSION IF NOT EXISTS pgcrypto;
