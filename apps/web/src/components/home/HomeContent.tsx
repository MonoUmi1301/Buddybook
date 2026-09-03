"use client";

import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { HeroCarousel, type HeroSlide } from "@/components/home/HeroCarousel";
import { NovelSection } from "@/components/home/NovelSection";
import { RecommendedBand } from "@/components/home/RecommendedBand";
import { CategoryPills } from "@/components/home/CategoryPills";
import { EmptyState } from "@/components/ui/EmptyState";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/cn";
import type { SessionUser } from "@/lib/api/session";
import type { NovelSummary } from "@/lib/types";

interface GenreSection {
  tagId: number;
  title: string;
  novels: NovelSummary[];
}

interface HomeContentProps {
  user: SessionUser | null;
  /** null = guest (ยังไม่ล็อกอิน) — ต่อกับ GET /recommendations จริงแล้ว (Neo4j) ดู app/page.tsx */
  recommended: NovelSummary[] | null;
  /** ทั้งหมดต่อกับ GET /novels/search จริงแล้ว (ดู app/page.tsx) — ไม่มี mock novel_id ปลอมอีกต่อไป */
  top: NovelSummary[];
  trending: NovelSummary[];
  /** หมวดตามแท็กจริงที่มีนิยายอยู่จริงอย่างน้อย 1 เรื่อง (กรองมาแล้วจาก app/page.tsx) */
  genreSections: GenreSection[];
  /** สไลด์ hero — สร้างจากนิยาย top-viewed จริงใน app/page.tsx (ไม่ใช้ mock heroSlides ที่ลิงก์ไป
   *  novel_id ปลอมอีกต่อไป) */
  heroSlides: HeroSlide[];
  /** เพิ่มภายหลัง (Phase K) — แท็ก genre ทั้งหมดจริง (ไม่ตัดเหลือ 4 เหมือน genreSections) ให้
   *  CategoryPills ลิงก์ไปกรองค้นหาได้จริง แทนปุ่มตกแต่งเฉย ๆ ที่กดแล้วไม่ทำอะไรเลยแบบเดิม */
  categoryTags: { tag_id: number; name: string }[];
  /** เพิ่มภายหลัง (BRIEF: Navbar Global Mode) — โหมดปัจจุบัน (จาก bb_work_type cookie, อ่านใน
   *  app/page.tsx) ต่อเข้า "ดูทั้งหมด" ให้ค้นหาต่อในโหมดเดิม ไม่ใช่รีเซ็ตกลับเป็นดูทั้งหมดปนกัน */
  workType?: "original" | "fan-fiction";
}

/**
 * เนื้อหาหน้า Home แยกเป็น Client Component เพราะต้องอ่านธีมจาก ThemeProvider (localStorage)
 * default เป็น light เสมอเหมือนหน้าอื่น ๆ ทั้งหมด — เวอร์ชัน dark (ตามที่ wireframe ออกแบบไว้)
 * จะเห็นได้ก็ต่อเมื่อผู้ใช้กดสลับธีมเองผ่านเมนู "ธีม" ใน UserMenu เท่านั้น
 */
export function HomeContent({
  user,
  recommended,
  top,
  trending,
  genreSections,
  heroSlides,
  categoryTags,
  workType,
}: HomeContentProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const modeSuffix = workType ? `&legal_status=${workType}` : "";

  return (
    <div className={cn("flex min-h-screen flex-col", isDark ? "bg-surface" : "bg-white")}>
      <Navbar theme={theme} user={user} />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
        {heroSlides.length > 0 && <HeroCarousel slides={heroSlides} />}

        {/* ย้ายขึ้นมาไว้บนสุด (เดิมอยู่ล่างสุดก่อน CategoryPills) ตามที่ขอ — ต้องการชูโรงส่วนนี้ */}
        {recommended === null ? (
          <section className="mt-10 rounded-2xl bg-brand-tan/90 px-4 py-8 text-center shadow-md sm:px-6 lg:px-8">
            <p className="text-lg font-bold text-brand-brown">เข้าสู่ระบบเพื่อดูคำแนะนำที่เหมาะกับคุณ</p>
            <p className="mt-1 text-sm text-brand-brown/80">
              เราจะแนะนำนิยายจากความสนใจและสิ่งที่คุณเคยอ่าน ไม่ใช่แค่เรื่องที่กำลังฮิต
            </p>
          </section>
        ) : recommended.length === 0 ? (
          <section className="mt-10 rounded-2xl bg-brand-tan/20 px-4 py-8 text-center shadow-sm sm:px-6 lg:px-8">
            <p className="text-sm text-brand-brown/80">
              ยังไม่มีคำแนะนำสำหรับคุณตอนนี้ — ลองเลือกความสนใจเพิ่ม หรืออ่าน/รีวิวนิยายสักเรื่องก่อน
            </p>
          </section>
        ) : (
          <RecommendedBand novels={recommended} />
        )}

        {top.length > 0 && (
          <NovelSection
            title="ติดท็อป"
            emoji="👑"
            novels={top}
            theme={theme}
            viewAllHref={`/search?sort=views${modeSuffix}`}
          />
        )}

        {trending.length > 0 && (
          <NovelSection
            title="ใหม่มาแรง"
            emoji="🔥"
            novels={trending}
            theme={theme}
            viewAllHref={`/search?sort=newest${modeSuffix}`}
          />
        )}

        {genreSections.map((section) => (
          <NovelSection
            key={section.tagId}
            title={section.title}
            novels={section.novels}
            theme={theme}
            viewAllHref={`/search?genre_ids=${section.tagId}${modeSuffix}`}
          />
        ))}

        {top.length === 0 && trending.length === 0 && genreSections.length === 0 && (
          <EmptyState
            title="ยังไม่มีนิยายเผยแพร่ในระบบตอนนี้"
            description="กลับมาดูใหม่อีกครั้งเมื่อมีผลงานเผยแพร่แล้ว"
            className="mt-10"
          />
        )}

        {categoryTags.length > 0 && <CategoryPills theme={theme} tags={categoryTags} />}
      </main>

      <Footer theme={theme} />
    </div>
  );
}
