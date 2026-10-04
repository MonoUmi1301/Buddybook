import type { MetadataRoute } from "next";

/**
 * Requirement ข้อ 5 — นักเขียนกังวลว่า AI จะดึงเนื้อหานิยายไปใช้
 * บอท AI/ชุดข้อมูลฝึกโมเดลที่รู้จัก: ห้ามเข้าเนื้อหาตอนทั้งหมด (หน้ารายละเอียดเรื่องยังให้ค้นเจอได้ปกติ)
 * ทุกบอท: ไม่ต้องเก็บหน้าเครื่องมือนักเขียน/แอดมิน/API — ฝั่ง API ยังมี rate limit การอ่านตอนกันการดูดข้อมูลอีกชั้น
 */
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Applebot-Extended",
  "PerplexityBot",
  "Bytespider",
  "Amazonbot",
  "meta-externalagent",
  "Diffbot",
  "cohere-ai",
  "Omgilibot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_CRAWLERS, disallow: ["/novels/*/chapters/", "/api/"] },
      { userAgent: "*", allow: "/", disallow: ["/write", "/admin", "/api/", "/wallet", "/settings", "/support", "/notifications"] },
    ],
  };
}
