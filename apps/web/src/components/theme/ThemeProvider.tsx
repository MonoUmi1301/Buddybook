"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Theme = "light" | "dark";

const THEME_STORAGE_KEY = "bb_theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * ธีมของ BuddyBook default เป็น light เสมอ ต้องกดสลับธีมเอง (เมนู "ธีม" ใน UserMenu) — เก็บค่าไว้ใน
 * localStorage เพื่อจำไว้ข้าม session
 *
 * เพิ่มภายหลัง (audit fix — full-site dark mode) — เดิม toggleTheme อัปเดตแค่ React state/
 * localStorage เฉย ๆ ทำให้มีผลแค่กับ Navbar/Footer ที่ query useTheme() ตรง ๆ เท่านั้น หน้าที่เหลือ
 * เกือบทั้งเว็บซึ่งเป็น Server Component (เรียก useTheme()/hook ไม่ได้เลย) จะไม่รู้เรื่องธีมด้วยซ้ำ
 * ตอนนี้ toggle/โหลดค่าเริ่มต้นจะ add/remove class "dark" ที่ html ตรง ๆ ด้วย ซึ่ง globals.css +
 * tailwind.config.ts ผูกสเกล neutral กับ bg-white ไว้กับ CSS variable ที่เปลี่ยนความหมายเมื่อมีคลาสนี้ —
 * ทำให้ทุกหน้า (ไม่ว่า Server หรือ Client Component) ตอบสนองธีมได้ทันทีโดยไม่ต้องเรียก useTheme()
 * ส่วน anti-flash ก่อน hydrate อยู่ที่ inline script ใน layout.tsx
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") {
      setTheme(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    }
  }, []);

  function toggleTheme() {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
      document.documentElement.classList.toggle("dark", next === "dark");
      return next;
    });
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
