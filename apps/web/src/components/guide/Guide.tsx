import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import type { SessionUser } from "@/lib/api/session";
import { cn } from "@/lib/cn";
import guideShots from "@/lib/guideShots.json";

/**
 * เพิ่มภายหลัง — โครงหน้าคู่มือ (/guide, /guide/coin, /faq)
 * ภาพประกอบอยู่ที่ public/guide/*.png ถ่ายจากเว็บจริงพร้อมวง/เลข/ลูกศร ด้วย e2e/guide-screenshots.ts
 * (UI เปลี่ยนเมื่อไรให้รันสคริปต์นั้นใหม่ เลขในภาพต้องตรงกับ legend ของ GuideShot)
 */

export const GUIDE_PAGES = [
  { href: "/guide", label: "คู่มือการใช้งาน" },
  { href: "/guide/coin", label: "วิธีเติม coin" },
  { href: "/faq", label: "คำถามที่พบบ่อย" },
] as const;

export function GuideLayout({
  user,
  current,
  title,
  intro,
  toc,
  children,
}: {
  user: SessionUser | null;
  current: (typeof GUIDE_PAGES)[number]["href"];
  title: string;
  intro: React.ReactNode;
  /** สารบัญด้านข้าง (จอกว้าง) / แถบชิปด้านบน (จอแคบ) */
  toc?: { id: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        <nav aria-label="หน้าคู่มือ" className="mb-6 flex flex-wrap gap-2">
          {GUIDE_PAGES.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              aria-current={p.href === current ? "page" : undefined}
              className={cn(
                "rounded-pill px-4 py-1.5 text-sm font-medium transition-colors",
                p.href === current
                  ? "bg-primary-500 text-white"
                  : "border border-neutral-200 text-neutral-600 hover:border-primary-300 hover:text-primary-600"
              )}
            >
              {p.label}
            </Link>
          ))}
        </nav>

        <h1 className="text-h2 text-neutral-900">{title}</h1>
        <div className="mt-2 max-w-3xl text-sm leading-relaxed text-neutral-600">{intro}</div>

        <div className={cn("mt-8", toc && "lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10")}>
          {toc && (
            <aside className="mb-8 lg:mb-0">
              <nav aria-label="หัวข้อในหน้านี้" className="lg:sticky lg:top-24">
                <p className="mb-2 hidden text-xs font-semibold uppercase tracking-wide text-neutral-400 lg:block">หัวข้อ</p>
                <ol className="flex flex-wrap gap-2 lg:flex-col lg:gap-0.5">
                  {toc.map((t, i) => (
                    <li key={t.id}>
                      <a
                        href={`#${t.id}`}
                        className="flex items-center gap-2 rounded-pill border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:border-primary-300 hover:text-primary-600 lg:rounded-lg lg:border-0 lg:px-2 lg:py-1.5 lg:text-sm lg:hover:bg-primary-50"
                      >
                        <span className="hidden h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-500 lg:inline-flex">
                          {i + 1}
                        </span>
                        {t.label}
                      </a>
                    </li>
                  ))}
                </ol>
              </nav>
            </aside>
          )}
          <div className="min-w-0 space-y-14">{children}</div>
        </div>

        <div className="mt-16 rounded-card bg-primary-50 px-5 py-4 text-sm text-neutral-700 dark:bg-primary-500/10">
          ยังติดขัดอยู่?{" "}
          <Link href="/faq" className="font-medium text-primary-600 hover:underline">
            ดูคำถามที่พบบ่อย
          </Link>{" "}
          หรือ{" "}
          <Link href="/support#ticket" className="font-medium text-primary-600 hover:underline">
            แจ้งทีมงาน
          </Link>{" "}
          ทีมงานจะตอบกลับและส่งแจ้งเตือนถึงคุณ
        </div>
      </main>
      <Footer />
    </div>
  );
}

/** หัวข้อใหญ่ 1 เรื่อง (เช่น "อ่านนิยาย") มีหลายขั้นตอนข้างใน */
export function GuideSection({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <h2 id={`${id}-title`} className="text-h3 text-neutral-900">
        {title}
      </h2>
      {lead && <p className="mt-1 text-sm leading-relaxed text-neutral-600">{lead}</p>}
      <ol className="mt-6 space-y-8">{children}</ol>
    </section>
  );
}

/** ขั้นตอน — เลขวงกลมด้านซ้าย เนื้อหา + ภาพประกอบด้านขวา */
export function GuideStep({ step, title, children }: { step: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500 text-sm font-bold text-white"
      >
        {step}
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-neutral-900">
          <span className="sr-only">ขั้นที่ {step}: </span>
          {title}
        </h3>
        <div className="mt-1.5 space-y-3 text-sm leading-relaxed text-neutral-700">{children}</div>
      </div>
    </li>
  );
}

/**
 * ภาพหน้าจอจริง + คำอธิบายเลขในภาพ — legend[i] คือคำอธิบายของเลข i+1 ที่วาดไว้ในภาพ
 * ขนาดภาพอ่านจาก lib/guideShots.json (สคริปต์ถ่ายภาพเขียนให้) ไม่ให้หน้ากระตุกตอนโหลด
 */
export function GuideShot({
  name,
  alt,
  legend,
  narrow,
}: {
  /** ชื่อไฟล์ใน public/guide (ไม่ต้องใส่ .png) */
  name: string;
  alt: string;
  legend?: React.ReactNode[];
  /** ภาพแนวตั้ง/เล็ก ไม่ต้องยืดเต็มความกว้าง */
  narrow?: boolean;
}) {
  const size = (guideShots as Record<string, { width: number; height: number }>)[name] ?? { width: 1280, height: 800 };
  return (
    <figure className="!mt-4">
      <div className={cn("overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-sm", narrow && "max-w-md")}>
        <Image
          src={`/guide/${name}.png`}
          alt={alt}
          width={size.width}
          height={size.height}
          className="h-auto w-full"
          sizes="(min-width: 1024px) 860px, 100vw"
        />
      </div>
      {legend && legend.length > 0 && (
        <figcaption className="mt-3">
          <ol className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {legend.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-neutral-700">
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#ef7d32] text-[11px] font-bold text-white"
                >
                  {i + 1}
                </span>
                <span>
                  <span className="sr-only">หมายเลข {i + 1}: </span>
                  {item}
                </span>
              </li>
            ))}
          </ol>
        </figcaption>
      )}
    </figure>
  );
}

/** กล่องเคล็ดลับ / ข้อควรระวัง */
export function GuideNote({ tone = "tip", children }: { tone?: "tip" | "warn"; children: React.ReactNode }) {
  return (
    <p
      className={cn(
        "rounded-lg px-4 py-2.5 text-sm",
        tone === "tip" ? "bg-sky-50 text-sky-900 dark:bg-sky-500/10 dark:text-sky-200" : "bg-amber-50 text-amber-900 dark:bg-amber-500/10 dark:text-amber-200"
      )}
    >
      <span className="font-semibold">{tone === "tip" ? "เคล็ดลับ: " : "ข้อควรรู้: "}</span>
      {children}
    </p>
  );
}

/** ชื่อปุ่ม/เมนูในเนื้อหา ให้เห็นชัดว่าต้องกดอะไร */
export function Ui({ children }: { children: React.ReactNode }) {
  return <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-medium text-neutral-900">{children}</span>;
}
