-- เพิ่มภายหลัง — จุดต่อเส้นทางบนแผนที่ (top/right/bottom/left) ที่ผู้ใช้ลากไว้
-- เดิมไม่ได้บันทึก รีเฟรชแล้ว react-flow เลือกจุดต่อเอง เส้นเลยย้ายตำแหน่ง (null = ให้เลือกเอง เหมือนเดิม)
ALTER TABLE "location_edges" ADD COLUMN "source_handle" VARCHAR(10);
ALTER TABLE "location_edges" ADD COLUMN "target_handle" VARCHAR(10);
