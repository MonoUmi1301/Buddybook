import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthFetchInterceptor } from "@/components/auth/AuthFetchInterceptor";
import { Toaster } from "@/components/ui/Toaster";
import { FaqChatButton } from "@/components/support/FaqChatButton";
import "./fonts.css";
import { NavigationTracker } from "@/components/layout/NavigationTracker";
import "./globals.css";
import "./gifts.css";

// ฟอนต์ (IBM Plex Sans Thai = ฟอนต์หลัก ตาม font.pdf, Noto Serif Thai/Sarabun = ฟอนต์ทางเลือกในหน้าอ่าน)
// เก็บไฟล์ไว้ในโปรเจกต์แล้ว — ดู ./fonts.css + public/fonts/ (เดิมใช้ next/font/google ซึ่งต้องโหลดจาก
// Google ตอน build/dev ทุกครั้ง เน็ตต่อ Google ไม่ได้ Turbopack จะ build error ทั้งเว็บ)
// CSS variable --font-ibm-plex-sans-thai / --font-noto-serif-thai / --font-sarabun ประกาศใน fonts.css

export const metadata: Metadata = {
  title: "BuddyBook",
  description: "แพลตฟอร์มนิยายออนไลน์ BuddyBook",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      // เพิ่มภายหลัง (audit fix — full-site dark mode) — inline script ด้านล่างเติม class "dark"
      // ให้ <html> ก่อน React hydrate เสร็จ ทำให้ HTML จริงกับสิ่งที่ React คาดไว้ตอน render ครั้งแรก
      // ไม่ตรงกันโดยเจตนา (React ไม่รู้จัก "dark" เพราะ Server Component ไม่เคย render มันเลย) —
      // suppressHydrationWarning ปิดแค่ warning ของ mismatch ที่ตั้งใจให้เกิดนี้จุดเดียว ไม่กระทบ
      // การเช็ค hydration mismatch จริงของ element อื่นในเว็บ
      suppressHydrationWarning
    >
      <head>
        {/* เพิ่มภายหลัง (audit fix — full-site dark mode) — ต้อง sync คลาส "dark" ก่อน paint แรก
         * ไม่งั้นจะกระพริบเป็น light ก่อนแล้วค่อยสลับเป็น dark ทีหลัง (ThemeProvider's useEffect
         * ทำงานหลัง hydrate) รันเป็น inline script ธรรมดา ไม่ผ่าน React เพราะต้องเกิดก่อน React
         * เริ่มทำงานเสียอีก — try/catch กัน localStorage ถูกบล็อก (private mode ฯลฯ) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem("bb_theme")==="dark"){document.documentElement.classList.add("dark")}}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen bg-white font-sans text-neutral-900 antialiased">
        <AuthFetchInterceptor />
        <ThemeProvider>
          {children}
          {/* ปุ่มแชทลอยมุมขวาล่าง — คำถามที่พบบ่อย (ซ่อนเองในหน้าอ่าน/หน้าเขียน/หลังบ้าน) */}
          <FaqChatButton />
        </ThemeProvider>
        <Toaster />
        <NavigationTracker />
      </body>
    </html>
  );
}
