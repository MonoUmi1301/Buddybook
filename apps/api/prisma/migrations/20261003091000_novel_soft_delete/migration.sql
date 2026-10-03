-- gap 2.4 — ลบนิยายแบบ soft delete 30 วัน (เดิม DELETE /novels/:id ลบถาวรทันทีพร้อมทุกตอน/เวอร์ชัน/ข้อมูลพล็อต)
ALTER TABLE "novels" ADD COLUMN "deleted_at" TIMESTAMPTZ(6);
ALTER TABLE "novels" ADD COLUMN "visibility_before_delete" "Visibility";

CREATE INDEX "novels_deleted_at_idx" ON "novels"("deleted_at");
