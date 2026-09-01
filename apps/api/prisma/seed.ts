import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** เพิ่มภายหลัง (Phase L) — แทนที่ลิสต์ genre แบบแบน 12 รายการเดิมด้วยโครงสร้าง 2 ระดับ
 *  (หมวดหมู่หลัก 7 + หมวดหมู่รอง 3-4 ต่อหมวด) ตามที่ผู้ใช้ระบุ ใช้ tag.parent_tag_id ผูกลำดับชั้น
 *  ชื่อที่ตรงกับแท็กเดิมเป๊ะ ๆ (แฟนตาซี/สยองขวัญ/ไซไฟ/ประวัติศาสตร์/ตลกขบขัน/ดราม่า) จะถูก
 *  "รียูส" เป็นแถวเดิม (upsert by name) ไม่สร้างซ้ำ — นิยายที่แท็กเดิมอยู่แล้วจึงไม่หลุด */
const genreTaxonomy: { main: string; subs: string[] }[] = [
  { main: "แฟนตาซี", subs: ["เกิดใหม่/ต่างโลก", "กำลังภายใน/ยุทธภพ", "โรงเรียนเวทมนตร์", "เกมออนไลน์/ระบบ"] },
  { main: "โรแมนติก", subs: ["รักหวานแหวว", "ดราม่า", "แอบรัก", "สัญญาหมั้นหมาย"] },
  { main: "สืบสวน & ระทึกขวัญ", subs: ["ไขคดี/ฆาตกรรม", "ชิงไหวชิงพริบ", "เอาชีวิตรอด"] },
  { main: "สยองขวัญ", subs: ["เรื่องเล่าสยองขวัญ", "ไสยศาสตร์", "สิ่งลึกลับ"] },
  { main: "ไซไฟ", subs: ["ล้ำยุค/หุ่นยนต์", "วันสิ้นโลก", "อวกาศ"] },
  { main: "ชีวิตประจำวัน & ดราม่า", subs: ["ตลกขบขัน", "สโลว์ไลฟ์", "สะท้อนสังคม"] },
  { main: "ประวัติศาสตร์", subs: ["จีนโบราณ", "ไทยพีเรียด", "ยุโรปโบราณ"] },
];

/** เพิ่มภายหลัง (Phase L, ปรับลิสต์ Phase P ตาม MASTER BRIEF) — preset ความสัมพันธ์/คู่ แบบ hybrid
 *  (เลือกจากลิสต์นี้ได้ไว หรือพิมพ์เองเพิ่มก็ได้ผ่าน pairing_tag_names) ตั้งใจแยกจาก genre เด็ดขาด
 *  ไม่มี parent_tag_id เชื่อมกับ genre ใด ๆ และไม่ถูกดึงเข้าช่องหมวดหมู่หลัก/รอง — ตัด "ฮาเร็มชาย/หญิง"
 *  ออกจาก preset ตามลิสต์ใหม่ที่ผู้ใช้ระบุ (ยังเลือกเองผ่านช่องพิมพ์แท็กอิสระได้เหมือนเดิม ไม่ได้ห้าม) */
const pairingPresets = [
  "ชายรักชาย (BL)",
  "หญิงรักหญิง (GL)",
  "ชายหญิง (Straight)",
  "ความสัมพันธ์หลากหลาย (LGBTQ+)",
  "ไม่เน้นความสัมพันธ์ (Gen)",
];

/** เพิ่มภายหลัง (Phase P) — preset ธีม/โทรปสำหรับหน้า Onboarding step 3 และ autocomplete
 *  "แท็กอื่นๆ" ในค้นหาแบบละเอียด category="freeform" (แยกจาก null ที่เป็นแท็กสุ่มที่ผู้ใช้พิมพ์เอง
 *  ตอนสร้างนิยาย ไม่ได้อยู่ใน preset ที่คัดสรรไว้) */
const freeformPresets = [
  "#เกิดใหม่",
  "#ระบบ",
  "#ต่างโลก",
  "#แก้แค้น",
  "#ฟีลกู้ด",
  "#ดราม่าตับพัง",
  "#คอมเมดี้",
  "#ทีมเวิร์ก",
  "#ลึกลับ",
  "#สงคราม",
  "#โรงเรียน",
  "#ราชวงศ์",
];

/** แท็ก genre แบนเดิม + preset เก่าที่ไม่มีคู่ตรงในโครงสร้าง/ลิสต์ใหม่ — ลดขั้นเป็นแท็กอิสระ
 *  (category=null) แทนการลบทิ้ง เพื่อไม่ให้ novel_tags ของนิยายที่ติดแท็กเหล่านี้อยู่แล้วพังหรือ
 *  FK หลุด (ฮาเร็มชาย/หญิง ถูกตัดออกจาก pairing preset รอบนี้ จึงลดขั้นมาอยู่ในกลุ่มนี้ด้วย) */
const demotedGenreTags = ["โรแมนซ์", "ผจญภัย", "ลึกลับ/สืบสวน", "วัยรุ่น", "เหนือธรรมชาติ", "กีฬา", "มหาวิทยาลัย/วัยเรียน"];
const demotedPairingTags = ["ฮาเร็มชาย", "ฮาเร็มหญิง", "ความสัมพันธ์หลากหลาย (LGBTQ+ / Non-Binary)"];

/** เพิ่มภายหลัง (Phase P) — ล้างแท็กทดสอบ/ขยะที่หลงเหลือจากการทดสอบจริงระหว่างพัฒนา
 *  (ตรวจแล้วว่าไม่มี novel ไหนอ้างอิงอยู่ก่อนลบ — ดู CHECKLIST.md Phase P) */
const junkTagNames = ["แท็กทดสอบใหม่QA"];

async function main() {
  for (const { main, subs } of genreTaxonomy) {
    const mainTag = await prisma.tag.upsert({
      where: { name: main },
      update: { category: "genre", parent_tag_id: null },
      create: { name: main, category: "genre", parent_tag_id: null },
    });
    for (const sub of subs) {
      await prisma.tag.upsert({
        where: { name: sub },
        update: { category: "genre", parent_tag_id: mainTag.tag_id },
        create: { name: sub, category: "genre", parent_tag_id: mainTag.tag_id },
      });
    }
  }

  for (const name of pairingPresets) {
    await prisma.tag.upsert({
      where: { name },
      update: { category: "pairing", parent_tag_id: null },
      create: { name, category: "pairing", parent_tag_id: null },
    });
  }

  for (const name of freeformPresets) {
    await prisma.tag.upsert({
      where: { name },
      update: { category: "freeform", parent_tag_id: null },
      create: { name, category: "freeform", parent_tag_id: null },
    });
  }

  for (const name of [...demotedGenreTags, ...demotedPairingTags]) {
    await prisma.tag.updateMany({ where: { name }, data: { category: null, parent_tag_id: null } });
  }

  const junkResult = await prisma.tag.deleteMany({ where: { name: { in: junkTagNames } } });

  const mainCount = genreTaxonomy.length;
  const subCount = genreTaxonomy.reduce((sum, g) => sum + g.subs.length, 0);
  console.log(
    `Seeded ${mainCount} main genres + ${subCount} sub-genres, ${pairingPresets.length} pairing presets, ` +
      `${freeformPresets.length} freeform theme presets, demoted ${demotedGenreTags.length + demotedPairingTags.length} legacy tags, ` +
      `deleted ${junkResult.count} junk tags.`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
