import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Noto_Serif_Thai, Sarabun } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthFetchInterceptor } from "@/components/auth/AuthFetchInterceptor";
import "./globals.css";

// ตาม font.pdf ใน buddybook_real/UI design — IBM Plex Sans Thai, Regular/Medium/Bold
const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "700"],
  variable: "--font-ibm-plex-sans-thai",
  display: "swap",
});

// เพิ่มภายหลัง (audit fix, reader toolbar) — ฟอนต์ทางเลือกสำหรับหน้าอ่านตอนนิยายเท่านั้น
// (ReaderContent.tsx) ไม่ได้ใช้เป็นฟอนต์หลักของเว็บ แค่ประกาศ CSS variable ไว้ที่ <html> ให้
// เรียกใช้ได้จากทุกที่ — Noto Serif Thai = แนวหนังสือเล่ม, Sarabun = อ่านสบายสำหรับเนื้อหายาว ๆ
const notoSerifThai = Noto_Serif_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "600"],
  variable: "--font-noto-serif-thai",
  display: "swap",
});

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["400", "500"],
  variable: "--font-sarabun",
  display: "swap",
});

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
      className={`${ibmPlexSansThai.variable} ${notoSerifThai.variable} ${sarabun.variable}`}
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
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
