-- เพิ่มภายหลัง — แผนผังตัวละครที่นักเขียนกด "เผยแพร่บนหน้านิยาย" (สำเนา ณ ตอนที่กด ไม่ใช่ข้อมูลสด
-- กันสปอยล์: นักเขียนแก้แผนภาพต่อได้โดยผู้อ่านยังเห็นฉบับเดิมจนกว่าจะกดเผยแพร่ใหม่) null = ไม่แสดง
ALTER TABLE "novels" ADD COLUMN "character_map_public" JSONB;
ALTER TABLE "novels" ADD COLUMN "character_map_published_at" TIMESTAMPTZ(6);
