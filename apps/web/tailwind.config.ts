import type { Config } from "tailwindcss";

// Desktop-first responsive design ตาม spec (breakpoint หลักคือ desktop, ค่อย scale ลง)
// สี/ฟอนต์อ้างอิงจากไฟล์ดีไซน์จริงใน buddybook_real/UI design
// (Logo.pdf, font.pdf, wireframe.pdf — หน้า Home ใช้ธีมมืด, หน้า auth/detail ใช้ธีมสว่าง)
const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    screens: {
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      // เพิ่มภายหลัง (audit fix — full-site dark mode) — ผูก neutral-* กับ CSS variable ใน
      // globals.css ให้ทุกหน้าที่ใช้ neutral-*/bg-white ตามปกติตอบสนอง .dark class อัตโนมัติ
      // (ดูคอมเมนต์เต็มใน globals.css) — เฉพาะ backgroundColor.white เท่านั้นที่ override เป็น
      // ตัวแปร ส่วน textColor.white (ตัวหนังสือบนปุ่มสี) ยังคงเป็น #fff ตายตัวเหมือนเดิม
      colors: {
        neutral: {
          50: "rgb(var(--color-neutral-50) / <alpha-value>)",
          100: "rgb(var(--color-neutral-100) / <alpha-value>)",
          200: "rgb(var(--color-neutral-200) / <alpha-value>)",
          300: "rgb(var(--color-neutral-300) / <alpha-value>)",
          400: "rgb(var(--color-neutral-400) / <alpha-value>)",
          500: "rgb(var(--color-neutral-500) / <alpha-value>)",
          600: "rgb(var(--color-neutral-600) / <alpha-value>)",
          700: "rgb(var(--color-neutral-700) / <alpha-value>)",
          800: "rgb(var(--color-neutral-800) / <alpha-value>)",
          900: "rgb(var(--color-neutral-900) / <alpha-value>)",
        },
        // แบรนด์หลัก — โลโก้ตัวหนังสือสีน้ำตาล + ปุ่ม/แบดจ์สีส้มอมน้ำตาล (ดู Logo.pdf, wf_login)
        brand: {
          brown: "#5B3A29",
          "brown-light": "#8A5A3F",
          tan: "#D9A879",
          "tan-dark": "#C08E5D",
        },
        // สีส้ม CTA หลัก — ปุ่ม/ลิงก์ "ดูทั้งหมด"/tag แอคทีฟ ในธีมมืด (ดู wf_home_dark, Section 1.pdf)
        primary: {
          50: "#FFF4EC",
          100: "#FFE4CC",
          200: "#FFC999",
          300: "#FBAA6B",
          400: "#F79A54",
          500: "#F0803C",
          600: "#DB6B28",
          700: "#B8551E",
          800: "#8F4118",
          900: "#6B3112",
        },
        // พื้นหลัง/พื้นผิวธีมมืด (หน้า Home) — ดำอมเทาเข้ม ไม่ใช่ดำสนิท
        surface: {
          DEFAULT: "#141414",
          raised: "#1E1E1E",
          border: "#2A2A2A",
          muted: "#232323",
        },
      },
      backgroundColor: {
        white: "rgb(var(--color-surface-card) / <alpha-value>)",
      },
      fontFamily: {
        sans: ["var(--font-ibm-plex-sans-thai)", "system-ui", "sans-serif"],
      },
      // ขนาด/น้ำหนักตาม font.pdf: H1 48 / H2 32 / H2.5 28 / H3 24 / P 16 (Bold/Medium/Regular)
      fontSize: {
        h1: ["3rem", { lineHeight: "1.2", fontWeight: "700" }],
        h2: ["2rem", { lineHeight: "1.25", fontWeight: "700" }],
        "h2-5": ["1.75rem", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["1.5rem", { lineHeight: "1.35", fontWeight: "600" }],
      },
      borderRadius: {
        card: "0.75rem",
        pill: "9999px",
      },
    },
  },
  plugins: [],
};

export default config;
