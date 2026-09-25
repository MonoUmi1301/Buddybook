/**
 * BuddyBook — ข้อมูลจำลอง (mockup) ครบชุดสำหรับ dev/demo
 *
 * สร้าง: ผู้ใช้ (นักเขียน 4 + นักอ่าน 5), ความสนใจ, นิยาย, ตอน, แท็ก, world-building,
 *        รีวิว, คอมเมนต์, ถูกใจ, ชั้นหนังสือ
 *
 * ต้องรัน seed.ts หลักก่อน (อ้างอิงแท็ก genre/pairing/freeform ตามชื่อ)
 *   npx tsx prisma/seed-mock-novels.ts
 *
 * - รันซ้ำได้: ลบข้อมูล mock ชุดเดิม (ระบุจากอีเมล @mock.buddybook.local) ก่อนสร้างใหม่ทุกครั้ง
 *   ไม่แตะข้อมูลของผู้ใช้จริง
 * - บัญชี mock เป็นแค่เจ้าของข้อมูล ไม่ได้ตั้งใจให้ login — ไม่มีรหัสผ่าน ใช้ oauth_id ปลอม
 *   เพื่อให้ผ่าน CHECK chk_users_has_login_method เท่านั้น
 * - ข้อมูลใน Neo4j ไม่ถูกสร้างที่นี่ ถ้าหน้าแนะนำดึงจาก graph ต้องรัน sync แยก
 */
import {
  PrismaClient,
  type NovelStatus,
  type LegalStatus,
  type Visibility,
  type NovelFormat,
  type ContentRating,
  type ChapterStatus,
  type CharacterRole,
  type SentimentLabel,
} from "@prisma/client";

const prisma = new PrismaClient();

const MOCK_EMAIL_DOMAIN = "mock.buddybook.local";
/** true = ใส่แท็ก genre (หลัก/รอง) ลง novel_tags ด้วย นอกเหนือจาก primary/secondary_tag_id
 *  ปิดได้ถ้าฝั่ง frontend แสดงแท็กซ้ำ */
const INCLUDE_GENRE_IN_NOVEL_TAGS = true;

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);
const daysFromNow = (n: number) => new Date(Date.now() + n * DAY);

/** นับคำภาษาไทยด้วย Intl.Segmenter (Node 16+) หลังตัด HTML tag ออก */
const segmenter = new Intl.Segmenter("th", { granularity: "word" });
function countWords(html: string): number {
  const text = html.replace(/<[^>]+>/g, " ");
  let n = 0;
  for (const s of segmenter.segment(text)) if (s.isWordLike) n++;
  return n;
}
const toHtml = (paragraphs: string[]) => paragraphs.map((p) => `<p>${p}</p>`).join("");

// ---------------------------------------------------------------------------
// ผู้ใช้จำลอง
// ---------------------------------------------------------------------------

type MockUser = { key: string; username: string; pen_name?: string; bio?: string; age_verified?: boolean };

const authors: MockUser[] = [
  { key: "mali", username: "mali_ink", pen_name: "มะลิหมึกจาง", bio: "เขียนแฟนตาซีกับสืบสวน ชอบฉากฝนตกและห้องสมุดเก่า", age_verified: true },
  { key: "khun", username: "khunkrabi", pen_name: "ขุนกระบี่", bio: "สายกำลังภายในและไซไฟ อัปทุกวันอาทิตย์", age_verified: true },
  { key: "pim", username: "pimwarin_writes", pen_name: "พิมพ์วรินทร์", bio: "โรแมนติกคอมเมดี้ ฟีลกู้ดเป็นหลัก ดราม่านิดหน่อยพอให้คิดถึง", age_verified: true },
  { key: "tawan", username: "tawan_yamkham", pen_name: "ตะวันยามค่ำ", bio: "เรื่องผี ไสยศาสตร์ และประวัติศาสตร์ไทย", age_verified: true },
];

const readers: MockUser[] = [
  { key: "sunny", username: "sunny_reads", pen_name: "ซันนี่เล่าต่อ", bio: "นักอ่านที่เผลอมาเขียนแฟนฟิค", age_verified: true },
  { key: "nong", username: "nongmew99", age_verified: false },
  { key: "book", username: "bookworm_bkk", age_verified: true },
  { key: "fah", username: "fah_ploy", age_verified: true },
  { key: "tonkla", username: "tonkla.reader", age_verified: false },
];

// ---------------------------------------------------------------------------
// นิยายจำลอง
// ---------------------------------------------------------------------------

type MockChapter = {
  title: string;
  paragraphs: string[];
  status?: ChapterStatus; // default published
  scheduledInDays?: number; // ใช้กับ status=scheduled
};

type MockCharacter = { key: string; name: string; role?: CharacterRole; description: string; x: number; y: number };
type MockCharEdge = { from: string; to: string; type: string; label: string };
type MockLocation = { key: string; name: string; description: string; icon: string; category: string; x: number; y: number; chapterIndex?: number };
type MockEvent = { title: string; description: string; date: string; thread: string; color: string; intensity: number };

type MockNovel = {
  key: string;
  author: string;
  title: string;
  synopsis: string;
  status: NovelStatus;
  legal_status?: LegalStatus;
  visibility?: Visibility;
  format?: NovelFormat;
  content_rating?: ContentRating;
  is_translated?: boolean;
  allow_donations?: boolean;
  allow_comments?: boolean;
  hide_like_count?: boolean;
  genreMain: string;
  genreSub: string;
  pairing: string;
  freeform: string[];
  fandom?: string;
  view_count: number;
  createdDaysAgo: number;
  chapters: MockChapter[];
  characters?: MockCharacter[];
  characterEdges?: MockCharEdge[];
  locations?: MockLocation[];
  locationRoads?: [string, string][];
  timeline?: MockEvent[];
  plot_notes?: Record<string, string>;
  theme_notes?: Record<string, string>;
};

const novels: MockNovel[] = [
  {
    key: "cloud-library",
    author: "mali",
    title: "ผู้พิทักษ์หอสมุดแห่งเมืองเมฆ",
    synopsis:
      "หลินดา เด็กฝึกงานประจำหอสมุดลอยฟ้าที่ไม่มีเวทมนตร์แม้แต่นิดเดียว ต้องออกตามหาหนังสือต้องห้ามที่หายไปจากชั้นลึกสุด ก่อนที่ตัวอักษรในหนังสือทุกเล่มของเมืองเมฆจะค่อย ๆ จางหาย",
    status: "ongoing",
    genreMain: "แฟนตาซี",
    genreSub: "โรงเรียนเวทมนตร์",
    pairing: "ไม่เน้นความสัมพันธ์ (Gen)",
    freeform: ["#โรงเรียน", "#ลึกลับ", "#ทีมเวิร์ก"],
    view_count: 18420,
    createdDaysAgo: 120,
    chapters: [
      {
        title: "หนังสือที่ไม่มีชื่อ",
        paragraphs: [
          "หอสมุดแห่งเมืองเมฆตั้งอยู่บนก้อนเมฆที่หนาที่สุดของฤดูฝน ทุกเช้าหลินดาต้องปีนบันไดไม้สามร้อยขั้นเพื่อไปเปิดหน้าต่างให้หนังสือได้หายใจ",
          "เช้าวันนั้นเธอพบช่องว่างบนชั้นลำดับที่เจ็ด ตรงที่เคยมีหนังสือปกหนังสีน้ำตาลเล่มหนึ่งวางอยู่ ไม่มีบัตรยืม ไม่มีบันทึก มีเพียงฝุ่นเป็นรูปสี่เหลี่ยมที่บอกว่ามันเคยอยู่ตรงนั้นมานานมาก",
          "\"ถ้าหนังสือหายไปเอง ก็แปลว่ามันอยากไปที่ไหนสักแห่ง\" บรรณารักษ์ใหญ่พูดโดยไม่เงยหน้าจากถ้วยชา แต่หลินดาเห็นมือของเขาสั่นเล็กน้อย",
        ],
      },
      {
        title: "ตัวอักษรที่เริ่มจางหาย",
        paragraphs: [
          "สามวันต่อมา นักเรียนในสถาบันเวทมนตร์ข้างหอสมุดเริ่มบ่นว่าตำราคาถาของพวกเขาอ่านไม่ออก ตัวอักษรซีดลงราวกับถูกแดดเผามาหลายสิบปี",
          "หลินดาไม่มีเวทมนตร์ แต่เธอจำตำแหน่งหนังสือทุกเล่มได้แม่นยำ และเธอสังเกตว่าหนังสือที่จางก่อน ล้วนเคยวางอยู่ใกล้ชั้นลำดับที่เจ็ดทั้งสิ้น",
        ],
      },
      {
        title: "เด็กชายผู้ได้ยินเสียงกระดาษ",
        paragraphs: [
          "ทาวิน นักเรียนปีหนึ่งที่สอบตกวิชาคาถาไฟสามครั้งติด บอกเธอว่าเขาได้ยินเสียงกระดาษพลิกดังมาจากใต้พื้นหอสมุดทุกคืน",
          "ทั้งคู่ตกลงกันว่าจะแอบลงไปดูตอนเที่ยงคืน โดยมีเพียงตะเกียงหนึ่งดวงกับแผนที่ที่หลินดาวาดเองจากความจำ",
          "สิ่งที่พวกเขาพบใต้พื้นไม่ใช่ห้องเก็บของ แต่เป็นบันไดวนที่ทอดลงไปในเมฆ ลึกจนมองไม่เห็นปลายทาง",
        ],
      },
      {
        title: "ชั้นลึกสุดของเมฆ",
        status: "scheduled",
        scheduledInDays: 3,
        paragraphs: [
          "ยิ่งลงลึก อากาศยิ่งเย็นและชื้น ผนังเมฆรอบตัวเต็มไปด้วยตัวอักษรที่ลอยวนอยู่เหมือนฝูงปลา หลินดาจำได้ทันทีว่ามันคือถ้อยคำที่หายไปจากหนังสือด้านบน",
          "และที่ก้นบันได หนังสือปกหนังสีน้ำตาลเล่มนั้นกำลังเปิดอยู่เอง พร้อมกับเงาของใครบางคนที่นั่งอ่านมันอย่างเงียบเชียบ",
        ],
      },
    ],
    characters: [
      { key: "linda", name: "หลินดา", role: "protagonist", description: "เด็กฝึกงานหอสมุด ไม่มีเวทมนตร์แต่ความจำเป็นเลิศ", x: 0, y: 0 },
      { key: "tawin", name: "ทาวิน", role: "supporting", description: "นักเรียนปีหนึ่ง ได้ยินเสียงของหนังสือ", x: 260, y: -40 },
      { key: "chief", name: "บรรณารักษ์ใหญ่โอฬาร", role: "supporting", description: "ผู้ดูแลหอสมุด ดูเหมือนรู้อะไรมากกว่าที่พูด", x: -240, y: 120 },
      { key: "reader", name: "ผู้อ่านในเงา", role: "antagonist", description: "ตัวตนปริศนาที่ขโมยถ้อยคำจากหนังสือทั้งเมือง", x: 60, y: 260 },
    ],
    characterEdges: [
      { from: "linda", to: "tawin", type: "friend", label: "เพื่อนร่วมสืบ" },
      { from: "chief", to: "linda", type: "mentor", label: "อาจารย์ / หัวหน้า" },
      { from: "chief", to: "reader", type: "secret", label: "ความลับในอดีต" },
      { from: "reader", to: "linda", type: "rival", label: "ศัตรู" },
    ],
    locations: [
      { key: "library", name: "หอสมุดลอยฟ้า", description: "หอสมุดไม้ห้าชั้นบนก้อนเมฆที่หนาที่สุดของเมือง", icon: "castle", category: "สถานที่สำคัญ", x: 200, y: 150, chapterIndex: 0 },
      { key: "academy", name: "สถาบันเวทมนตร์ปีกเมฆ", description: "โรงเรียนเวทมนตร์ข้างหอสมุด นักเรียนราวสองร้อยคน", icon: "tower", category: "ที่พักอาศัย", x: 420, y: 120 },
      { key: "stairs", name: "บันไดวนใต้เมฆ", description: "ทางลับใต้พื้นหอสมุด ไม่มีใครรู้ว่าสร้างเมื่อไร", icon: "cave", category: "อันตราย", x: 220, y: 380, chapterIndex: 2 },
    ],
    locationRoads: [
      ["library", "academy"],
      ["library", "stairs"],
    ],
    timeline: [
      { title: "หนังสือต้องห้ามหายไป", description: "หลินดาพบช่องว่างบนชั้นลำดับที่เจ็ด", date: "วันที่ 1 ฤดูฝน", thread: "หลินดา", color: "#6c8ebf", intensity: 4 },
      { title: "ตำราคาถาเริ่มจาง", description: "นักเรียนทั้งสถาบันอ่านตำราไม่ออก", date: "วันที่ 4 ฤดูฝน", thread: "เมืองเมฆ", color: "#b85450", intensity: 6 },
      { title: "ลงบันไดใต้เมฆ", description: "หลินดากับทาวินพบทางลับ", date: "วันที่ 5 ฤดูฝน", thread: "หลินดา", color: "#6c8ebf", intensity: 8 },
    ],
    plot_notes: {
      intro: "หลินดาพบว่าหนังสือต้องห้ามหายไป",
      twist: "บรรณารักษ์ใหญ่เคยเป็นศิษย์ของผู้อ่านในเงา",
    },
    theme_notes: { mainTheme: "ความทรงจำคือเวทมนตร์ชนิดหนึ่ง", symbol: "ตัวอักษรที่จางหาย", message: "คนธรรมดาก็ปกป้องสิ่งสำคัญได้" },
  },
  {
    key: "shadowless-sword",
    author: "khun",
    title: "ตำนานกระบี่ไร้เงา",
    synopsis:
      "สิบปีหลังสำนักกระบี่ธาราถูกเผาวอด ศิษย์คนสุดท้ายที่รอดชีวิตกลับสู่ยุทธภพพร้อมกระบี่ที่ไม่ทอดเงา เพื่อทวงความยุติธรรมจากพันธมิตรเก้าสำนัก แต่ยิ่งสืบลึก เขายิ่งพบว่าคนที่ต้องแก้แค้นอาจเป็นคนที่เขาเคยเรียกว่าพี่ชาย",
    status: "completed",
    content_rating: "teen",
    genreMain: "แฟนตาซี",
    genreSub: "กำลังภายใน/ยุทธภพ",
    pairing: "ชายหญิง (Straight)",
    freeform: ["#แก้แค้น", "#สงคราม"],
    view_count: 96310,
    createdDaysAgo: 400,
    chapters: [
      {
        title: "คืนที่สำนักธาราไหม้",
        paragraphs: [
          "เปลวไฟสะท้อนบนผิวน้ำของทะเลสาบจนดูเหมือนน้ำเองกำลังลุกไหม้ เซียวหลานในวัยสิบสองขวบซ่อนตัวอยู่ใต้สะพานไม้ ได้ยินเสียงกระบี่ปะทะกันไม่ขาดสาย",
          "ก่อนสิ้นใจ อาจารย์ยัดกระบี่เล่มหนึ่งใส่มือเขา มันเบาราวกับขนนก และใต้แสงไฟที่สว่างจ้า มันไม่ทอดเงาลงบนพื้นเลยแม้แต่น้อย",
        ],
      },
      {
        title: "โรงเตี๊ยมริมทางหลวง",
        paragraphs: [
          "สิบปีต่อมา ชายหนุ่มผมยาวสวมงอบนั่งดื่มชาอยู่มุมโรงเตี๊ยม ข่าวลือเรื่องกระบี่ไร้เงาแพร่ไปทั่วแคว้นใต้ แต่ไม่มีใครคิดว่าเจ้าของมันจะนั่งอยู่ตรงหน้า",
          "หญิงสาวชุดแดงวางถ้วยสุราลงบนโต๊ะเขาโดยไม่ขออนุญาต \"ข้าชื่อหงอิ๋ง และข้ารู้ว่าเจ้ากำลังตามหาใคร\"",
        ],
      },
      {
        title: "พี่ชายผู้อยู่หลังม่าน (ตอนจบ)",
        paragraphs: [
          "ยอดเขาเก้าสำนักปกคลุมด้วยหิมะ เซียวหลานยืนเผชิญหน้ากับชายที่เคยสอนเขาจับกระบี่ครั้งแรก ชายที่ทุกคนเชื่อว่าตายไปในคืนเดียวกับอาจารย์",
          "\"กระบี่ไร้เงาไม่ได้มีไว้ฆ่าคน\" พี่ชายพูดเบา ๆ \"มันมีไว้ตัดสิ่งที่มองไม่เห็น\" และในวินาทีนั้น เซียวหลานก็เข้าใจว่าสิ่งที่เขาต้องตัดคือความแค้นของตัวเอง",
        ],
      },
    ],
    characters: [
      { key: "xiao", name: "เซียวหลาน", role: "protagonist", description: "ศิษย์คนสุดท้ายของสำนักธารา", x: 0, y: 0 },
      { key: "hong", name: "หงอิ๋ง", role: "supporting", description: "นักข่าวกรองแห่งยุทธภพ สวมชุดแดงเสมอ", x: 240, y: 60 },
      { key: "brother", name: "เซียวเฟิง", role: "antagonist", description: "ศิษย์พี่ที่หายสาบสูญ", x: -200, y: 200 },
    ],
    characterEdges: [
      { from: "xiao", to: "hong", type: "love", label: "คนรัก" },
      { from: "brother", to: "xiao", type: "family", label: "ศิษย์พี่ / ผู้ทรยศ" },
    ],
  },
  {
    key: "hundred-day-contract",
    author: "pim",
    title: "สัญญารักร้อยวันของคุณชายรอง",
    synopsis:
      "แพรวา นักบัญชีที่ติดหนี้ร้านดอกไม้ของแม่หกแสน ได้รับข้อเสนอแปลกประหลาดจากคุณชายรองของตระกูลใหญ่ แกล้งเป็นคู่หมั้นกันแค่ร้อยวันเพื่อหนีการคลุมถุงชน สัญญาชัดเจน ห้ามรักจริง แต่ใครจะไปรู้ว่าข้อที่ยากที่สุดคือข้อสุดท้าย",
    status: "ongoing",
    genreMain: "โรแมนติก",
    genreSub: "สัญญาหมั้นหมาย",
    pairing: "ชายหญิง (Straight)",
    freeform: ["#คอมเมดี้", "#ฟีลกู้ด"],
    view_count: 54200,
    createdDaysAgo: 75,
    chapters: [
      {
        title: "ข้อเสนอที่ไม่ควรรับ",
        paragraphs: [
          "\"คุณแค่ต้องยิ้มตอนอยู่ต่อหน้าแม่ผม ที่เหลือผมจัดการเอง\" ภาคินเลื่อนเอกสารสามหน้าข้ามโต๊ะมาอย่างใจเย็น เหมือนกำลังเสนอราคาที่ดิน ไม่ใช่เสนอการหมั้น",
          "แพรวาอ่านข้อสัญญาทีละบรรทัดด้วยความเคยชินของนักบัญชี ข้อหนึ่งถึงข้อเก้าดูสมเหตุสมผล จนมาถึงข้อสิบที่เขียนตัวหนาไว้ว่า ห้ามคู่สัญญาตกหลุมรักกันโดยเด็ดขาด",
          "\"ข้อนี้ไม่ต้องเขียนก็ได้มั้งคะ\" เธอพูดพลางเซ็นชื่อ",
        ],
      },
      {
        title: "มื้อเย็นกับคุณหญิงแม่",
        paragraphs: [
          "คุณหญิงแม่ของภาคินถามคำถามแรกตั้งแต่ยังไม่เสิร์ฟซุป \"เจอกันที่ไหนจ๊ะ\" และทั้งคู่ก็ตอบพร้อมกัน คนหนึ่งบอกว่าที่ร้านกาแฟ อีกคนบอกว่าที่งานสัมมนา",
          "ความเงียบที่ตามมายาวนานพอจะทำให้แพรวานึกถึงยอดหนี้ทุกบาท ก่อนที่ภาคินจะหัวเราะแล้วบอกว่า \"เจอที่งานสัมมนาครับ แต่คุยกันครั้งแรกที่ร้านกาแฟ\"",
        ],
      },
      {
        title: "วันที่สิบเจ็ด",
        paragraphs: [
          "แพรวาเริ่มจดบันทึกนับวันในโทรศัพท์ วันที่สิบเจ็ด เขาจำได้ว่าเธอไม่กินผักชี วันที่สิบเจ็ด เธอจำได้ว่าเขาชอบกาแฟดำแต่แอบเติมน้ำตาลเมื่อไม่มีใครเห็น",
          "เธอบอกตัวเองว่านี่คือการเก็บข้อมูลเพื่อเล่นบทให้แนบเนียน ไม่ใช่อย่างอื่น",
        ],
      },
    ],
  },
  {
    key: "room-404",
    author: "mali",
    title: "คดีฆาตกรรมห้อง 404",
    synopsis:
      "หอพักนักศึกษาเก่าแก่ที่ไม่มีห้อง 404 อยู่ในแผนผัง แต่ศพของรุ่นพี่ปีสี่กลับถูกพบในห้องหมายเลขนั้น ตำรวจสรุปว่าเป็นอุบัติเหตุ มีเพียงนักศึกษานิติวิทยาศาสตร์ปีสองกับเพื่อนร่วมห้องจอมขี้เกียจที่ไม่เชื่อ",
    status: "ongoing",
    content_rating: "teen",
    genreMain: "สืบสวน & ระทึกขวัญ",
    genreSub: "ไขคดี/ฆาตกรรม",
    pairing: "ไม่เน้นความสัมพันธ์ (Gen)",
    freeform: ["#ลึกลับ", "#ทีมเวิร์ก"],
    view_count: 12780,
    createdDaysAgo: 40,
    chapters: [
      {
        title: "ห้องที่ไม่มีอยู่จริง",
        paragraphs: [
          "หอพักอาคารเจ็ดมีห้องตั้งแต่ 401 ถึง 403 แล้วข้ามไป 405 ทุกคนรู้เรื่องนี้ดี และไม่มีใครเคยถามว่าทำไม จนกระทั่งเช้าวันจันทร์ที่แม่บ้านกรีดร้องหน้าผนังว่างเปล่าระหว่างห้อง 403 กับ 405",
          "ผนังนั้นมีประตู และหลังประตูมีห้องขนาดสามคูณสี่เมตร กับร่างของพี่ต้นกล้า ประธานชมรมถ่ายภาพ",
        ],
      },
      {
        title: "ฟิล์มม้วนสุดท้าย",
        paragraphs: [
          "ใบพลูพบกล้องฟิล์มของผู้ตายตกอยู่ใต้เตียงในรูปถ่ายที่ตำรวจเผยแพร่ แต่ในรายการของกลางกลับไม่มีกล้องตัวนั้น",
          "\"ถ้ากล้องหาย แปลว่ามีคนกลับเข้าไปในห้องหลังจากตำรวจถ่ายรูปแล้ว\" เธอพูดกับกาย เพื่อนร่วมห้องที่ยังนอนคลุมโปงอยู่ \"และคนคนนั้นต้องรู้ทางเข้าห้องที่ไม่มีในแผนผัง\"",
        ],
      },
      {
        title: "(ร่าง) คำให้การของยามกะดึก",
        status: "draft",
        paragraphs: ["ยามเล่าว่าคืนนั้นเห็นไฟในห้องที่ไม่มีเลขติดอยู่... (ยังเขียนไม่เสร็จ)"],
      },
    ],
  },
  {
    key: "bang-luang-house",
    author: "tawan",
    title: "บ้านไม้หลังคลองบางหลวง",
    synopsis:
      "หลังแม่เสียชีวิต นิลได้รับมรดกเป็นบ้านไม้ริมคลองที่เธอไม่เคยรู้ว่ามีอยู่ ในห้องใต้หลังคามีหิ้งบูชาที่ถูกตอกตะปูปิดไว้ และทุกคืนตีสาม จะมีเสียงคนเคาะจากข้างในนั้นสามครั้ง",
    status: "hiatus",
    content_rating: "mature",
    genreMain: "สยองขวัญ",
    genreSub: "ไสยศาสตร์",
    pairing: "ไม่เน้นความสัมพันธ์ (Gen)",
    freeform: ["#ลึกลับ", "#ดราม่าตับพัง"],
    view_count: 30955,
    createdDaysAgo: 210,
    chapters: [
      {
        title: "มรดกริมคลอง",
        paragraphs: [
          "เรือหางยาวจอดส่งนิลที่ท่าน้ำผุพัง บ้านไม้สองชั้นตรงหน้าดูเก่ากว่าที่ทนายบอกไว้มาก หน้าต่างทุกบานปิดสนิท ยกเว้นบานเล็ก ๆ บนหลังคาที่เปิดแง้มอยู่บานเดียว",
          "ป้าข้างบ้านยืนมองเธอจากนอกชาน \"หนูเป็นลูกคุณจันทร์ใช่ไหม\" แล้วก็พูดต่อโดยไม่รอคำตอบ \"อย่าขึ้นไปข้างบนหลังพระอาทิตย์ตกนะลูก\"",
        ],
      },
      {
        title: "เสียงเคาะตีสาม",
        paragraphs: [
          "นิลตื่นขึ้นเพราะเสียงเคาะ ช้า ๆ สามครั้ง หนักแน่นเหมือนมีคนใช้ข้อนิ้วเคาะแผ่นไม้ เสียงมาจากเหนือศีรษะ ตรงกับตำแหน่งของหิ้งที่ถูกตอกปิด",
          "เธอนับในใจ หนึ่ง สอง สาม แล้วความเงียบก็กลับมา นานจนเธอเกือบเชื่อว่าตัวเองฝันไป จนกระทั่งเสียงที่สี่ดังขึ้น คราวนี้ไม่ได้มาจากข้างบน แต่มาจากประตูห้องนอนของเธอเอง",
        ],
      },
    ],
  },
  {
    key: "kepler-signal",
    author: "khun",
    title: "สัญญาณสุดท้ายจากสถานีเคปเลอร์",
    synopsis:
      "เรื่องสั้นจบในตอน: ลูกเรือสามคนสุดท้ายของสถานีวิจัยที่ขอบระบบสุริยะได้รับสัญญาณที่ส่งมาจากโลก ปัญหาคือข้อความนั้นลงวันที่ไว้ในอีกสี่สิบปีข้างหน้า (แปลและเรียบเรียงจากต้นฉบับภาษาอังกฤษของผู้เขียนเอง)",
    status: "completed",
    format: "one_shot",
    is_translated: true,
    genreMain: "ไซไฟ",
    genreSub: "อวกาศ",
    pairing: "ไม่เน้นความสัมพันธ์ (Gen)",
    freeform: ["#ทีมเวิร์ก"],
    view_count: 7420,
    createdDaysAgo: 90,
    chapters: [
      {
        title: "สัญญาณสุดท้ายจากสถานีเคปเลอร์",
        paragraphs: [
          "ข้อความมาถึงตอนตีสองตามเวลาสถานี สั้นเพียงเจ็ดคำ ไม่มีรหัสยืนยัน ไม่มีตราหน่วยงาน มีเพียงประทับเวลาที่ทำให้วิศวกรสื่อสารอย่างมิรามองหน้าจอนานกว่าห้านาที",
          "\"ระบบรวน\" ผู้บัญชาการเดชาสรุปทันที แต่นักชีววิทยาหนุ่มที่อายุน้อยที่สุดในสถานีกลับถามคำถามที่ไม่มีใครอยากได้ยิน \"ถ้ามันไม่ได้รวนล่ะครับ ถ้ามีใครข้างหน้าพยายามเตือนเรา\"",
          "เจ็ดคำนั้นเขียนว่า อย่าเปิดประตูห้องเก็บตัวอย่างหมายเลขสาม",
          "สามคนนั่งล้อมโต๊ะในห้องอาหารที่เงียบที่สุดในรอบหลายปี และเป็นครั้งแรกนับจากวันที่ส่งเสบียงล่าช้า ที่พวกเขาตัดสินใจอะไรบางอย่างร่วมกันโดยไม่ต้องรอคำสั่งจากโลก",
          "ประตูห้องหมายเลขสามถูกเชื่อมปิดตั้งแต่เช้าวันนั้น และสี่สิบปีต่อมา ใครบางคนบนโลกก็ได้รับสัญญาณตอบกลับที่ลงวันที่ย้อนหลังไปสี่สิบปี เขียนเพียงสองคำว่า ขอบคุณที่เตือน",
        ],
      },
    ],
  },
  {
    key: "two-cats-cafe",
    author: "pim",
    title: "ร้านกาแฟสองแมวกับเรื่องธรรมดาของเรา",
    synopsis:
      "ออมกลับมาเปิดร้านกาแฟเล็ก ๆ ที่บ้านเกิดหลังลาออกจากงานในกรุงเทพฯ ลูกค้าประจำคนแรกคือเจน ครูศิลปะโรงเรียนประถมที่มาสั่งลาเต้แก้วเดิมทุกเช้า พร้อมแมวส้มที่ไม่ยอมบอกว่าเป็นของใคร",
    status: "ongoing",
    genreMain: "ชีวิตประจำวัน & ดราม่า",
    genreSub: "สโลว์ไลฟ์",
    pairing: "หญิงรักหญิง (GL)",
    freeform: ["#ฟีลกู้ด"],
    hide_like_count: true,
    view_count: 21030,
    createdDaysAgo: 60,
    chapters: [
      {
        title: "ลาเต้หวานน้อย",
        paragraphs: [
          "ร้านเปิดวันแรกมีลูกค้าสามคน หนึ่งในนั้นคือป้าที่มาถามทางไปตลาด อีกคนคือแมวส้มที่เดินเข้ามานอนบนเก้าอี้ริมหน้าต่างเหมือนเป็นเจ้าของร้าน",
          "คนที่สามสั่งลาเต้หวานน้อย แล้วก็นั่งวาดรูปแมวตัวนั้นอยู่ครึ่งชั่วโมง ก่อนจะวางกระดาษไว้บนเคาน์เตอร์พร้อมเงินค่ากาแฟ \"ของขวัญเปิดร้านค่ะ\"",
        ],
      },
      {
        title: "แมวตัวที่สอง",
        paragraphs: [
          "สัปดาห์ต่อมา แมวส้มพาเพื่อนมาด้วย เป็นแมวดำตาสีเหลืองที่ขี้อายกว่ามาก เจนตั้งชื่อให้ทั้งสองตัวว่าส้มโอกับถ่าน ออมบอกว่าชื่อไม่เข้ากันเลย เจนบอกว่านั่นแหละคือเหตุผล",
          "ร้านจึงได้ชื่อใหม่แบบไม่ได้ตั้งใจ เด็ก ๆ ในซอยเรียกกันว่าร้านสองแมว และออมก็ไม่เคยเปลี่ยนป้ายอีกเลย",
        ],
      },
      {
        title: "ฝนตกวันอังคาร",
        paragraphs: [
          "ฝนตกหนักจนไม่มีลูกค้าเลยทั้งบ่าย เจนติดฝนอยู่ในร้าน ทั้งสองนั่งฟังเสียงฝนกับเสียงแมวกรน และคุยกันเรื่องที่ไม่เคยเล่าให้ใครฟัง",
          "ตอนฝนหยุด ออมรู้สึกเสียดายนิดหนึ่ง และนั่นคือครั้งแรกที่เธอรู้ตัวว่ากำลังรอเช้าวันพุธ",
        ],
      },
    ],
  },
  {
    key: "wrong-reign",
    author: "tawan",
    title: "เสด็จกลับมาในรัชกาลที่ผิดเพี้ยน",
    synopsis:
      "อาจารย์ประวัติศาสตร์หนุ่มลืมตาตื่นในร่างขุนนางชั้นผู้น้อยของกรุงศรีอยุธยา ในรัชกาลที่ไม่เคยมีบันทึกไว้ในพงศาวดารฉบับใด ความรู้ทั้งหมดที่เขามีจึงไร้ค่า เหลือเพียงสัญชาตญาณ และองครักษ์หน้านิ่งที่คอยจับตาเขาอยู่ตลอดเวลา",
    status: "ongoing",
    content_rating: "teen",
    genreMain: "ประวัติศาสตร์",
    genreSub: "ไทยพีเรียด",
    pairing: "ชายรักชาย (BL)",
    freeform: ["#เกิดใหม่", "#ราชวงศ์"],
    view_count: 67800,
    createdDaysAgo: 150,
    chapters: [
      {
        title: "ตื่นมาในเรือนไม้สัก",
        paragraphs: [
          "กลิ่นกำยานกับเสียงระฆังวัดปลุกภูมิให้ตื่น เพดานเหนือหัวเป็นไม้สักแกะลาย ไม่ใช่ฝ้าห้องพักอาจารย์ที่รั่วมาสามปี",
          "ชายหนุ่มในชุดองครักษ์คุกเข่าอยู่ข้างเตียง \"ท่านหมื่นฟื้นแล้ว\" เขาพูดเสียงเรียบ แต่ดวงตาไม่ได้เรียบตามเลยสักนิด",
        ],
      },
      {
        title: "พงศาวดารที่ไม่มีอยู่",
        paragraphs: [
          "ภูมิถามชื่อพระเจ้าแผ่นดินอย่างระมัดระวัง คำตอบที่ได้ทำให้เขาเย็นวาบ เพราะเขาไม่เคยได้ยินพระนามนี้มาก่อน ทั้งที่สอนประวัติศาสตร์อยุธยามาสิบปี",
          "\"ท่านหมื่นถามแปลก\" องครักษ์ที่ชื่อแก้วว่า \"เหมือนคนที่เพิ่งมาจากที่อื่น\"",
        ],
      },
      {
        title: "คำสาบานใต้ต้นโพธิ์",
        paragraphs: [
          "เมื่อความลับถูกเปิดเผย แก้วไม่ได้ชักดาบ เขาเพียงนั่งลงใต้ต้นโพธิ์แล้วเล่าเรื่องท่านหมื่นคนเดิมที่เขาปกป้องมาตลอดชีวิต และคืนที่ท่านหมื่นคนนั้นตายไป",
          "\"ข้าจะคุ้มครองร่างนี้ต่อ\" เขาบอก \"ส่วนจะคุ้มครองคนข้างในด้วยหรือไม่ ให้เวลาเป็นเครื่องตัดสิน\"",
        ],
      },
    ],
  },
  {
    key: "sword-fanfic",
    author: "sunny",
    title: "ตำนานกระบี่ไร้เงา: บันทึกนอกพงศาวดารของหงอิ๋ง",
    synopsis:
      "แฟนฟิคเล่าเรื่องจากมุมของหงอิ๋ง ช่วงสามปีที่หายไประหว่างเล่มหนึ่งกับเล่มสอง เธอไปทำอะไรมา และทำไมถึงรู้เรื่องของเซียวหลานมากกว่าที่ควรจะรู้",
    status: "ongoing",
    legal_status: "fan_fiction",
    visibility: "pending_review",
    content_rating: "teen",
    allow_donations: false,
    genreMain: "แฟนตาซี",
    genreSub: "กำลังภายใน/ยุทธภพ",
    pairing: "ชายหญิง (Straight)",
    freeform: [],
    fandom: "ตำนานกระบี่ไร้เงา",
    view_count: 0,
    createdDaysAgo: 5,
    chapters: [
      {
        title: "ชุดแดงตัวแรก",
        paragraphs: [
          "ก่อนจะเป็นหงอิ๋งแห่งหอข่าวกรอง เธอเคยเป็นเด็กเก็บของเก่าในเมืองท่า และชุดแดงตัวแรกของเธอก็ไม่ได้ซื้อมา แต่ขโมยมาจากราวตากผ้าของโรงงิ้ว",
          "คืนนั้นเธอได้ยินชื่อสำนักธาราเป็นครั้งแรก จากปากของชายที่ต่อมาเธอจะเรียกว่าอาจารย์",
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// ปฏิสัมพันธ์ผู้อ่าน
// ---------------------------------------------------------------------------

const reviews: { novel: string; user: string; rating: number; text: string; label: SentimentLabel; score: number; anonymous?: boolean }[] = [
  { novel: "shadowless-sword", user: "book", rating: 5, text: "ตอนจบทำเอานั่งเงียบไปนาน ฉากสู้บนยอดเขาคือที่สุด", label: "pos", score: 0.95 },
  { novel: "shadowless-sword", user: "fah", rating: 4, text: "ช่วงกลางเรื่องยืดไปนิด แต่ปมพี่ชายคุ้มค่ามาก", label: "pos", score: 0.72 },
  { novel: "shadowless-sword", user: "sunny", rating: 5, text: "รักหงอิ๋งมาก จนต้องไปเขียนแฟนฟิคเอง", label: "pos", score: 0.97 },
  { novel: "hundred-day-contract", user: "nong", rating: 5, text: "น่ารักมาก ยิ้มตามทุกตอน", label: "pos", score: 0.93 },
  { novel: "hundred-day-contract", user: "tonkla", rating: 3, text: "พล็อตคุ้น ๆ แต่เขียนอ่านเพลินดี", label: "neutral", score: 0.51 },
  { novel: "cloud-library", user: "book", rating: 5, text: "บรรยากาศหอสมุดบนเมฆสวยมาก อยากให้เป็นแอนิเมชัน", label: "pos", score: 0.9 },
  { novel: "bang-luang-house", user: "fah", rating: 4, text: "หลอนจริง อ่านตอนกลางคืนไม่ไหว รอตอนต่อไปนะคะ", label: "pos", score: 0.68 },
  { novel: "bang-luang-house", user: "book", rating: 2, text: "หยุดอัปนานเกินไป ลืมเนื้อเรื่องไปแล้ว", label: "neg", score: 0.22, anonymous: true },
  { novel: "wrong-reign", user: "fah", rating: 5, text: "เคมีภูมิกับแก้วดีมาก รายละเอียดยุคก็แน่น", label: "pos", score: 0.94 },
  { novel: "two-cats-cafe", user: "tonkla", rating: 5, text: "อ่านแล้วอยากไปนั่งร้านกาแฟต่างจังหวัด", label: "pos", score: 0.88 },
  { novel: "kepler-signal", user: "nong", rating: 4, text: "สั้นแต่หักมุมดี", label: "pos", score: 0.75 },
];

// chapterIndex = ลำดับตอน (0-based), replyTo = index ของคอมเมนต์ก่อนหน้าในอาร์เรย์นี้
const comments: { novel: string; chapterIndex: number; user: string; text: string; label: SentimentLabel; score: number; replyTo?: number }[] = [
  { novel: "cloud-library", chapterIndex: 0, user: "book", text: "บรรณารักษ์ใหญ่ต้องรู้อะไรแน่ ๆ", label: "neutral", score: 0.55 },
  { novel: "cloud-library", chapterIndex: 0, user: "mali", text: "ใบ้ให้ว่าจับตาดูถ้วยชาไว้ค่ะ", label: "pos", score: 0.7, replyTo: 0 },
  { novel: "cloud-library", chapterIndex: 2, user: "nong", text: "ทาวินน่ารักมาก สอบตกคาถาไฟสามรอบ 555", label: "pos", score: 0.86 },
  { novel: "shadowless-sword", chapterIndex: 2, user: "fah", text: "ร้องไห้หนักมากตอนนี้", label: "pos", score: 0.64 },
  { novel: "shadowless-sword", chapterIndex: 1, user: "tonkla", text: "หงอิ๋งเปิดตัวเท่มาก", label: "pos", score: 0.91 },
  { novel: "hundred-day-contract", chapterIndex: 1, user: "nong", text: "ตอบพร้อมกันคนละที่ ขำจนสำลัก", label: "pos", score: 0.89 },
  { novel: "hundred-day-contract", chapterIndex: 2, user: "book", text: "ข้อสิบพังแน่นอน", label: "neutral", score: 0.5 },
  { novel: "room-404", chapterIndex: 1, user: "tonkla", text: "กล้องหายไปไหน ตำรวจไม่เอะใจเลยเหรอ", label: "neg", score: 0.35 },
  { novel: "bang-luang-house", chapterIndex: 1, user: "book", text: "เสียงที่สี่คืออะไร ไม่นะ", label: "neg", score: 0.3 },
  { novel: "wrong-reign", chapterIndex: 2, user: "fah", text: "ประโยคสุดท้ายของแก้ว", label: "pos", score: 0.92 },
  { novel: "two-cats-cafe", chapterIndex: 2, user: "sunny", text: "รอวันพุธด้วยคนค่ะ", label: "pos", score: 0.84 },
];

const likes: Record<string, string[]> = {
  "shadowless-sword": ["book", "fah", "sunny", "nong", "tonkla"],
  "hundred-day-contract": ["nong", "fah", "tonkla", "sunny"],
  "cloud-library": ["book", "nong", "fah"],
  "wrong-reign": ["fah", "sunny", "book"],
  "two-cats-cafe": ["tonkla", "sunny"],
  "bang-luang-house": ["fah"],
  "kepler-signal": ["nong", "book"],
  "room-404": ["tonkla"],
};

const library: Record<string, string[]> = {
  book: ["shadowless-sword", "cloud-library", "room-404"],
  fah: ["wrong-reign", "bang-luang-house", "shadowless-sword"],
  nong: ["hundred-day-contract", "cloud-library"],
  tonkla: ["two-cats-cafe", "room-404", "kepler-signal"],
  sunny: ["shadowless-sword", "two-cats-cafe"],
};

const interests: Record<string, string[]> = {
  book: ["แฟนตาซี", "สืบสวน & ระทึกขวัญ", "#ลึกลับ"],
  fah: ["ประวัติศาสตร์", "สยองขวัญ", "ชายรักชาย (BL)"],
  nong: ["โรแมนติก", "#คอมเมดี้", "#ฟีลกู้ด"],
  tonkla: ["ชีวิตประจำวัน & ดราม่า", "ไซไฟ"],
  sunny: ["แฟนตาซี", "กำลังภายใน/ยุทธภพ", "#แก้แค้น"],
};

// ---------------------------------------------------------------------------

async function cleanup() {
  const mockUsers = await prisma.user.findMany({
    where: { email: { endsWith: `@${MOCK_EMAIL_DOMAIN}` } },
    select: { user_id: true },
  });
  const ids = mockUsers.map((u) => u.user_id);
  if (ids.length === 0) return;
  // comments/reviews.user_id ไม่ cascade จากฝั่ง user จึงต้องลบก่อน แล้วค่อยลบนิยาย (cascade ไปตอน/
  // world-building/likes/library) และผู้ใช้ตามลำดับ
  await prisma.comment.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.review.deleteMany({ where: { user_id: { in: ids } } });
  await prisma.novel.deleteMany({ where: { author_id: { in: ids } } });
  await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
}

async function main() {
  await cleanup();

  // --- tags ---
  const allTags = await prisma.tag.findMany();
  const tagByName = new Map(allTags.map((t) => [t.name, t]));
  const requireTag = (name: string) => {
    const t = tagByName.get(name);
    if (!t) throw new Error(`ไม่พบแท็ก "${name}" — รัน seed.ts หลักก่อน`);
    return t;
  };
  for (const n of novels) {
    if (n.fandom && !tagByName.has(n.fandom)) {
      const t = await prisma.tag.upsert({
        where: { name: n.fandom },
        update: {},
        create: { name: n.fandom, category: "fandom" },
      });
      tagByName.set(t.name, t);
    }
  }

  // --- users ---
  const userId = new Map<string, string>();
  for (const [i, u] of [...authors, ...readers].entries()) {
    const created = await prisma.user.create({
      data: {
        username: u.username,
        pen_name: u.pen_name ?? null,
        email: `${u.username.replace(/\./g, "_")}@${MOCK_EMAIL_DOMAIN}`,
        password_hash: null,
        oauth_provider: "google",
        oauth_id: `mock-${u.username}`,
        bio: u.bio ?? null,
        age_verified: u.age_verified ?? false,
        created_at: daysAgo(420 - i * 10),
      },
    });
    userId.set(u.key, created.user_id);
  }

  for (const [key, names] of Object.entries(interests)) {
    await prisma.userInterest.createMany({
      data: names.map((name) => ({ user_id: userId.get(key)!, tag_id: requireTag(name).tag_id })),
      skipDuplicates: true,
    });
  }

  // --- novels ---
  const novelId = new Map<string, string>();
  const chapterIds = new Map<string, string[]>();

  for (const n of novels) {
    const main = requireTag(n.genreMain);
    const sub = requireTag(n.genreSub);
    if (sub.parent_tag_id !== main.tag_id) throw new Error(`"${n.genreSub}" ไม่ได้อยู่ใต้ "${n.genreMain}"`);

    const created = n.createdDaysAgo;
    const publishedChapters = n.chapters.filter((c) => (c.status ?? "published") === "published").length;
    const gap = Math.max(1, Math.floor(created / Math.max(publishedChapters, 1)));

    const novel = await prisma.novel.create({
      data: {
        author_id: userId.get(n.author)!,
        title: n.title,
        synopsis: n.synopsis,
        cover_image_url: `https://picsum.photos/seed/buddybook-${n.key}/400/600`,
        status: n.status,
        legal_status: n.legal_status ?? "original",
        visibility: n.visibility ?? "published",
        format: n.format ?? "multi_chapter",
        content_rating: n.content_rating ?? "all_ages",
        is_translated: n.is_translated ?? false,
        allow_donations: n.allow_donations ?? true,
        allow_comments: n.allow_comments ?? true,
        hide_like_count: n.hide_like_count ?? false,
        view_count: BigInt(n.view_count),
        primary_tag_id: main.tag_id,
        secondary_tag_id: sub.tag_id,
        plot_notes: n.plot_notes,
        theme_notes: n.theme_notes,
        created_at: daysAgo(created),
        updated_at: daysAgo(Math.max(0, created - gap * publishedChapters)),
      },
    });

    novelId.set(n.key, novel.novel_id);

    const tagNames = [
      ...(INCLUDE_GENRE_IN_NOVEL_TAGS ? [n.genreMain, n.genreSub] : []),
      n.pairing,
      ...n.freeform,
      ...(n.fandom ? [n.fandom] : []),
    ];
    await prisma.novelTag.createMany({
      data: tagNames.map((name) => ({ novel_id: novel.novel_id, tag_id: requireTag(name).tag_id })),
      skipDuplicates: true,
    });

    const ids: string[] = [];
    for (const [idx, c] of n.chapters.entries()) {
      const status = c.status ?? "published";
      const content = toHtml(c.paragraphs);
      const at = daysAgo(Math.max(0, created - gap * idx));
      const ch = await prisma.chapter.create({
        data: {
          novel_id: novel.novel_id,
          chapter_number: idx + 1,
          title: c.title,
          content,
          status,
          word_count: countWords(content),
          published_at: status === "published" ? at : null,
          scheduled_publish_at: status === "scheduled" ? daysFromNow(c.scheduledInDays ?? 1) : null,
          created_at: at,
        },
      });
      ids.push(ch.chapter_id);
    }
    chapterIds.set(n.key, ids);

    // --- world-building (เฉพาะเรื่องที่กำหนดไว้) ---
    if (n.characters?.length) {
      const nodeId = new Map<string, string>();
      for (const ch of n.characters) {
        const node = await prisma.characterNode.create({
          data: {
            novel_id: novel.novel_id,
            character_name: ch.name,
            description: ch.description,
            character_role: ch.role ?? null,
            position_x: ch.x,
            position_y: ch.y,
          },
        });
        nodeId.set(ch.key, node.node_id);
      }
      for (const e of n.characterEdges ?? []) {
        await prisma.characterEdge.create({
          data: {
            novel_id: novel.novel_id,
            source_node_id: nodeId.get(e.from)!,
            target_node_id: nodeId.get(e.to)!,
            relationship_type: e.type,
            edge_label: e.label,
          },
        });
      }
    }

    if (n.locations?.length) {
      const locId = new Map<string, string>();
      for (const [z, l] of n.locations.entries()) {
        const loc = await prisma.location.create({
          data: {
            novel_id: novel.novel_id,
            name: l.name,
            description: l.description,
            map_icon_url: l.icon,
            category: l.category,
            pos_x: l.x,
            pos_y: l.y,
            z_index: z,
            linked_chapter_id: l.chapterIndex !== undefined ? ids[l.chapterIndex] : null,
          },
        });
        locId.set(l.key, loc.location_id);
      }
      for (const [a, b] of n.locationRoads ?? []) {
        await prisma.locationEdge.create({
          data: { novel_id: novel.novel_id, source_location_id: locId.get(a)!, target_location_id: locId.get(b)! },
        });
      }
    }

    if (n.timeline?.length) {
      await prisma.timelineEvent.createMany({
        data: n.timeline.map((e, i) => ({
          novel_id: novel.novel_id,
          title: e.title,
          description: e.description,
          event_order: i + 1,
          event_date_in_story: e.date,
          thread: e.thread,
          color: e.color,
          intensity: e.intensity,
        })),
      });
    }
  }

  // --- reader interactions ---
  for (const r of reviews) {
    await prisma.review.create({
      data: {
        novel_id: novelId.get(r.novel)!,
        user_id: userId.get(r.user)!,
        rating: r.rating,
        comment_text: r.text,
        sentiment_label: r.label,
        sentiment_score: r.score,
        is_anonymous: r.anonymous ?? false,
      },
    });
  }

  const commentIds: string[] = [];
  for (const c of comments) {
    const created = await prisma.comment.create({
      data: {
        chapter_id: chapterIds.get(c.novel)![c.chapterIndex],
        user_id: userId.get(c.user)!,
        parent_comment_id: c.replyTo !== undefined ? commentIds[c.replyTo] : null,
        content: c.text,
        sentiment_label: c.label,
        sentiment_score: c.score,
      },
    });
    commentIds.push(created.comment_id);
  }

  for (const [novel, users] of Object.entries(likes)) {
    await prisma.novelLike.createMany({
      data: users.map((u) => ({ novel_id: novelId.get(novel)!, user_id: userId.get(u)! })),
      skipDuplicates: true,
    });
  }

  for (const [user, novelKeys] of Object.entries(library)) {
    await prisma.userLibrary.createMany({
      data: novelKeys.map((k, i) => ({ user_id: userId.get(user)!, novel_id: novelId.get(k)!, added_at: daysAgo(30 - i * 7) })),
      skipDuplicates: true,
    });
  }

  const chapterTotal = [...chapterIds.values()].reduce((s, a) => s + a.length, 0);
  console.log(
    `Mock data: ${authors.length + readers.length} users, ${novels.length} novels, ${chapterTotal} chapters, ` +
      `${reviews.length} reviews, ${comments.length} comments`
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
