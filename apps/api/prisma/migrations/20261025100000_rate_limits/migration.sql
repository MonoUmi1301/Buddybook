-- code audit L4 — ตัวนับ rate limit ย้ายจาก memory ของ process มาไว้ในฐานข้อมูล
-- (นับร่วมกันทุก instance และไม่รีเซ็ตเมื่อรีสตาร์ต) แบบ fixed window ต่อ key (bucket:ผู้ใช้/อีเมล/IP)
CREATE TABLE "rate_limits" (
    "key" VARCHAR(200) NOT NULL,
    "window_start" TIMESTAMPTZ(6) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limits_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "rate_limits_window_start_idx" ON "rate_limits"("window_start");
