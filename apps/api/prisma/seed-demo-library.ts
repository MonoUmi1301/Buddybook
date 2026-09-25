/**
 * BuddyBook — ผู้ใช้เดโมสำหรับหน้า My Library (ชั้นหนังสือ / ชั้นย่อย / ความคืบหน้าการอ่าน)
 *
 * สร้าง: นักอ่านเดโมที่ล็อกอินได้จริง 1 คน + นักเขียนเดโม 1 คน (เจ้าของนิยายตัวอย่าง 12 เรื่อง)
 *        ชั้นหนังสือ ~20 เรื่อง (นิยายตัวอย่าง + นิยาย mock ที่เผยแพร่อยู่), สถานะ, ความคืบหน้า, 3 ชั้นย่อย
 *
 * ต้องรันหลัง seed.ts และ seed-mock-novels.ts
 *   npx tsx prisma/seed-demo-library.ts
 *
 * ล็อกอิน: demo_reader@demo.buddybook.local / demo1234
 * รันซ้ำได้: ลบผู้ใช้ @demo.buddybook.local ชุดเดิม (cascade ไปนิยาย/ชั้น/ความคืบหน้า) ก่อนสร้างใหม่
 */
import bcrypt from "bcryptjs";
import { PrismaClient, type LibraryStatus, type NovelStatus } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_DOMAIN = "demo.buddybook.local";
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

// ชื่อกลาง ๆ ไม่อ้างอิงผลงานจริง — เป็นแค่ของตัวอย่างให้ชั้นหนังสือมีของ
const placeholderNovels: { title: string; chapters: number; status: NovelStatus; genre: string; views: number }[] = [
  { title: "เงาของสายลมเดือนสิบ", chapters: 32, status: "ongoing", genre: "แฟนตาซี", views: 8420 },
  { title: "บ้านริมทางรถไฟ", chapters: 18, status: "completed", genre: "ชีวิตประจำวัน & ดราม่า", views: 5120 },
  { title: "จดหมายถึงดาวดวงที่เจ็ด", chapters: 24, status: "ongoing", genre: "โรแมนติก", views: 12900 },
  { title: "เมืองที่ไม่มีวันอาทิตย์", chapters: 40, status: "ongoing", genre: "ไซไฟ", views: 21400 },
  { title: "ร้านซ่อมนาฬิกาตอนตีสาม", chapters: 12, status: "completed", genre: "สยองขวัญ", views: 9300 },
  { title: "ทะเลสาบกระจก", chapters: 27, status: "hiatus", genre: "สืบสวน & ระทึกขวัญ", views: 4380 },
  { title: "สวนหลังบ้านของคุณยาย", chapters: 9, status: "completed", genre: "ชีวิตประจำวัน & ดราม่า", views: 3150 },
  { title: "แผนที่ที่วาดด้วยดินสอ", chapters: 21, status: "ongoing", genre: "แฟนตาซี", views: 7760 },
  { title: "ฤดูฝนในห้องสมุด", chapters: 15, status: "ongoing", genre: "โรแมนติก", views: 6040 },
  { title: "สถานีสุดท้ายของรถเมล์สาย 8", chapters: 30, status: "completed", genre: "สืบสวน & ระทึกขวัญ", views: 15600 },
  { title: "เสียงกระดิ่งจากภูเขา", chapters: 11, status: "ongoing", genre: "ประวัติศาสตร์", views: 2890 },
  { title: "ปีกกระดาษ", chapters: 26, status: "ongoing", genre: "ไซไฟ", views: 10230 },
];

// [ลำดับนิยายตัวอย่าง, สถานะในชั้น, ตอนที่อ่านล่าสุด (0 = ยังไม่อ่าน), อ่านล่าสุดกี่ชั่วโมงก่อน]
const demoShelf: [number, LibraryStatus, number, number][] = [
  [0, "reading", 17, 2],
  [2, "reading", 9, 20],
  [3, "reading", 33, 30],
  [7, "reading", 4, 50],
  [11, "reading", 21, 96],
  [5, "reading", 12, 240],
  [1, "completed", 18, 400],
  [4, "completed", 12, 700],
  [9, "completed", 30, 900],
  [6, "up_next", 0, 0],
  [8, "up_next", 0, 0],
  [10, "up_next", 0, 0],
];

const collections: { name: string; icon: string; tint: string; novels: number[]; mockTitles?: string[] }[] = [
  { name: "อ่านริมทะเล", icon: "waves", tint: "blue", novels: [2, 8, 6], mockTitles: ["ร้านกาแฟสองแมวกับเรื่องธรรมดาของเรา"] },
  { name: "ขนหัวลุก", icon: "ghost", tint: "purple", novels: [4, 5, 9], mockTitles: ["คดีฆาตกรรมห้อง 404"] },
  { name: "จัดเต็มวันหยุด", icon: "coffee", tint: "orange", novels: [0, 3, 7, 11, 10], mockTitles: ["ตำนานกระบี่ไร้เงา", "ผู้พิทักษ์หอสมุดแห่งเมืองเมฆ"] },
];

async function cleanup() {
  const users = await prisma.user.findMany({ where: { email: { endsWith: `@${DEMO_DOMAIN}` } }, select: { user_id: true } });
  const ids = users.map((u) => u.user_id);
  if (ids.length === 0) return;
  await prisma.novel.deleteMany({ where: { author_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
}

async function main() {
  await cleanup();

  const tags = new Map((await prisma.tag.findMany()).map((t) => [t.name, t]));
  const genre = (name: string) => {
    const t = tags.get(name);
    if (!t) throw new Error(`ไม่พบแท็ก "${name}" — รัน seed.ts หลักก่อน`);
    return t;
  };

  const author = await prisma.user.create({
    data: {
      username: "demo_shelf_author",
      pen_name: "นักเขียนตัวอย่าง",
      email: `demo_shelf_author@${DEMO_DOMAIN}`,
      oauth_provider: "google",
      oauth_id: "demo-shelf-author",
      bio: "บัญชีตัวอย่างสำหรับนิยายในชั้นหนังสือเดโม",
      created_at: daysAgo(300),
    },
  });

  const reader = await prisma.user.create({
    data: {
      username: "demo_reader",
      pen_name: "นักอ่านเดโม",
      email: `demo_reader@${DEMO_DOMAIN}`,
      password_hash: await bcrypt.hash("demo1234", 10),
      bio: "บัญชีเดโมสำหรับลองหน้า My Library",
      age_verified: true,
      created_at: daysAgo(200),
    },
  });

  await prisma.userInterest.createMany({
    data: ["แฟนตาซี", "โรแมนติก", "สืบสวน & ระทึกขวัญ"].map((n) => ({ user_id: reader.user_id, tag_id: genre(n).tag_id })),
  });

  // --- นิยายตัวอย่าง + ตอน ---
  const novels: { novel_id: string; chapterIds: string[] }[] = [];
  for (const [i, n] of placeholderNovels.entries()) {
    const novel = await prisma.novel.create({
      data: {
        author_id: author.user_id,
        title: n.title,
        synopsis: `นิยายตัวอย่างสำหรับหน้า My Library — ${n.title}`,
        cover_image_url: `https://picsum.photos/seed/buddybook-demo-${i}/400/600`,
        status: n.status,
        view_count: BigInt(n.views),
        primary_tag_id: genre(n.genre).tag_id,
        created_at: daysAgo(250 - i * 10),
      },
    });
    const chapterIds: string[] = [];
    for (let c = 1; c <= n.chapters; c++) {
      const ch = await prisma.chapter.create({
        data: {
          novel_id: novel.novel_id,
          chapter_number: c,
          title: `ตอนที่ ${c}`,
          content: `<p>เนื้อหาตัวอย่างของ${n.title} ตอนที่ ${c}</p>`,
          status: "published",
          word_count: 1800 + ((i * 37 + c * 53) % 1400),
          published_at: daysAgo(240 - i * 10 - c),
        },
      });
      chapterIds.push(ch.chapter_id);
    }
    novels.push({ novel_id: novel.novel_id, chapterIds });
  }

  // --- ชั้นหนังสือ + ความคืบหน้า ---
  for (const [idx, status, lastChapter, hours] of demoShelf) {
    const { novel_id, chapterIds } = novels[idx];
    await prisma.userLibrary.create({
      data: { user_id: reader.user_id, novel_id, status, added_at: daysAgo(60 - idx * 3) },
    });
    if (lastChapter > 0) {
      await prisma.readingProgress.create({
        data: {
          user_id: reader.user_id,
          novel_id,
          last_chapter_id: chapterIds[lastChapter - 1],
          last_chapter_number: lastChapter,
          last_read_at: hoursAgo(hours),
        },
      });
    }
  }

  // นิยาย mock ที่เผยแพร่อยู่ (จาก seed-mock-novels.ts) — ใส่ชั้นด้วยให้ครบ ~20 เรื่อง
  const mockNovels = await prisma.novel.findMany({
    where: { visibility: "published", author: { email: { endsWith: "@mock.buddybook.local" } } },
    select: { novel_id: true, title: true, chapters: { where: { status: "published" }, orderBy: { chapter_number: "asc" }, select: { chapter_id: true, chapter_number: true } } },
  });
  const mockByTitle = new Map(mockNovels.map((n) => [n.title, n]));
  for (const [i, n] of mockNovels.entries()) {
    const status: LibraryStatus = i % 3 === 0 ? "reading" : i % 3 === 1 ? "up_next" : "completed";
    await prisma.userLibrary.create({ data: { user_id: reader.user_id, novel_id: n.novel_id, status, added_at: daysAgo(20 + i) } });
    const last = status === "completed" ? n.chapters.at(-1) : status === "reading" ? n.chapters[Math.min(1, n.chapters.length - 1)] : undefined;
    if (last) {
      await prisma.readingProgress.create({
        data: {
          user_id: reader.user_id,
          novel_id: n.novel_id,
          last_chapter_id: last.chapter_id,
          last_chapter_number: last.chapter_number,
          last_read_at: hoursAgo(6 + i * 11),
        },
      });
    }
  }

  // --- ชั้นย่อย ---
  for (const [position, c] of collections.entries()) {
    const ids = [
      ...c.novels.map((i) => novels[i].novel_id),
      ...(c.mockTitles ?? []).map((t) => mockByTitle.get(t)?.novel_id).filter((id): id is string => !!id),
    ];
    await prisma.collection.create({
      data: {
        user_id: reader.user_id,
        name: c.name,
        icon: c.icon,
        tint: c.tint,
        position,
        items: { create: ids.map((novel_id, i) => ({ novel_id, position: i })) },
      },
    });
  }

  const total = await prisma.userLibrary.count({ where: { user_id: reader.user_id } });
  console.log(
    `Demo library: ${placeholderNovels.length} placeholder novels, ${total} books on shelf, ${collections.length} collections ` +
      `— login demo_reader@${DEMO_DOMAIN} / demo1234`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
