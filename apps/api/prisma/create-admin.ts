/**
 * สร้าง (หรืออัปเดต) บัญชีแอดมินสำหรับเข้าดูหน้า /admin — ใช้ในเครื่องตัวเองเท่านั้น
 *
 *   npx tsx prisma/create-admin.ts
 *   npx tsx prisma/create-admin.ts --email you@example.com          ← เลื่อนบัญชีที่มีอยู่แล้วเป็นแอดมิน
 *   npx tsx prisma/create-admin.ts --email a@b.com --password Xyz12345 ← สร้าง/ตั้งรหัสผ่านใหม่
 *
 * ค่าเริ่มต้น: admin@buddybook.local / Admin@1234 (username: admin)
 * รันซ้ำได้: ถ้ามีอีเมลนี้อยู่แล้ว จะเปลี่ยน role เป็น admin (และตั้งรหัสใหม่ถ้าส่ง --password มา)
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = (arg("email") ?? "admin@buddybook.local").toLowerCase();
  const passwordArg = arg("password");
  const existing = await prisma.user.findUnique({ where: { email }, select: { user_id: true, username: true } });

  if (existing) {
    await prisma.user.update({
      where: { email },
      data: {
        role: "admin",
        is_suspended: false,
        deleted_at: null,
        ...(passwordArg ? { password_hash: await bcrypt.hash(passwordArg, 10) } : {}),
      },
    });
    console.log(`✔ เลื่อนบัญชี ${email} (username: ${existing.username}) เป็นแอดมินแล้ว`);
    if (passwordArg) console.log(`  รหัสผ่านใหม่: ${passwordArg}`);
    return;
  }

  const password = passwordArg ?? "Admin@1234";
  let username = "admin";
  for (let n = 2; await prisma.user.findUnique({ where: { username }, select: { user_id: true } }); n++) username = `admin${n}`;

  // ใส่แท็กความสนใจ 1 อัน ให้ข้ามหน้า onboarding ตอนล็อกอินครั้งแรก
  const genre = await prisma.tag.findFirst({ where: { category: "genre", parent_tag_id: null }, select: { tag_id: true } });

  await prisma.user.create({
    data: {
      username,
      pen_name: "แอดมิน BuddyBook",
      email,
      password_hash: await bcrypt.hash(password, 10),
      role: "admin",
      ...(genre ? { user_interests: { create: { tag_id: genre.tag_id } } } : {}),
    },
  });
  console.log("✔ สร้างบัญชีแอดมินแล้ว");
  console.log(`  อีเมล:    ${email}`);
  console.log(`  รหัสผ่าน: ${password}`);
  console.log(`  username: ${username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
