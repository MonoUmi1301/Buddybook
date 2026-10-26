import sanitizeHtml from "sanitize-html";

/** ข้อความจัดรูปแบบจาก Quill (เช่น "แนะนำเรื่อง" ของนิยาย) — เก็บเป็น HTML ที่กรองแล้วเท่านั้น
 *  เหลือแค่แท็กจัดรูปแบบ + class จัดหน้า/เยื้องของ Quill + สีตัวอักษร/พื้นหลัง ตัด script/event handler/style อื่นทิ้ง */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: ["p", "br", "strong", "b", "em", "i", "u", "s", "span", "a", "sub", "sup", "blockquote", "ol", "ul", "li", "hr", "h2", "h3"],
  allowedAttributes: {
    "*": ["class"],
    a: ["href", "target", "rel"],
    li: ["data-list", "class"],
    span: ["style", "class"],
    p: ["class"],
  },
  allowedClasses: {
    "*": [/^ql-align-(center|right|justify)$/, /^ql-indent-[1-8]$/, "scene-break"],
  },
  allowedStyles: {
    span: {
      color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
      "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s,.%]+\)$/i],
    },
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { target: "_blank", rel: "noopener noreferrer nofollow" }),
  },
};

/** เนื้อหาตอน (Quill ตัวเต็มใน ChapterEditorForm) — ชุดเดียวกับ "แนะนำเรื่อง" บวกรูป วิดีโอ และเส้นคั่นฉาก
 *  วิดีโอ (Quill ใส่เป็น iframe.ql-video) รับเฉพาะ YouTube/Vimeo ; รูปรับ data: ด้วยเพราะตอนเก่าฝังรูปแบบ
 *  base64 ไว้ก่อนมี image handler (data: ใน <img> รันสคริปต์ไม่ได้) */
const CHAPTER_OPTIONS: sanitizeHtml.IOptions = {
  ...OPTIONS,
  allowedTags: [...(OPTIONS.allowedTags as string[]), "h1", "img", "iframe"],
  allowedAttributes: {
    ...OPTIONS.allowedAttributes,
    img: ["src", "alt", "width", "height"],
    iframe: ["src", "class", "frameborder", "allowfullscreen"],
  },
  allowedClasses: {
    "*": [/^ql-align-(center|right|justify)$/, /^ql-indent-[1-8]$/, "scene-break", "ql-video"],
  },
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com", "player.vimeo.com"],
  allowIframeRelativeUrls: false,
};

/** กรองเนื้อหาตอนก่อนบันทึกและก่อนส่งออก — หน้าอ่านเรนเดอร์ด้วย dangerouslySetInnerHTML จึงต้องเป็น HTML
 *  ที่ปลอดภัยเสมอ (กันนักเขียนยิง API ตรงใส่ <img onerror> / <script> ให้รันในเบราว์เซอร์ผู้อ่าน)
 *  ข้อความธรรมดาผ่านได้เหมือนเดิม (แค่ escape อักขระพิเศษ) ไม่แปลงเป็น <p> เพื่อไม่ให้เนื้อหาเดิมเปลี่ยนรูป */
export function toSafeChapterHtml<T extends string | null | undefined>(value: T): T {
  if (!value) return value;
  return sanitizeHtml(value, CHAPTER_OPTIONS) as T;
}

const HTML_RE = /<(p|br|strong|em|u|s|span|a|ol|ul|li|blockquote|h[1-6]|hr)\b[^>]*>/i;

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** แปลงค่าที่เก็บไว้ให้เป็น HTML ปลอดภัย — ข้อมูลเก่าเป็นข้อความธรรมดา (คั่นย่อหน้าด้วยขึ้นบรรทัด)
 *  แปลงทีละบรรทัดเป็น <p> ; ค่าว่าง (ไม่มีตัวอักษรจริง เช่น "<p><br></p>" ของ Quill) คืน null */
export function toSafeRichText(value: string | null | undefined): string | null {
  if (!value) return null;
  const html = HTML_RE.test(value)
    ? value
    : value
        .replace(/\r\n?/g, "\n")
        .trim()
        .split("\n")
        .map((line) => `<p>${line.trim() ? escapeHtml(line) : "<br>"}</p>`)
        .join("");
  const clean = sanitizeHtml(html, OPTIONS).trim();
  const hasText = sanitizeHtml(clean, { allowedTags: [], allowedAttributes: {} }).replace(/&nbsp;/g, " ").trim();
  return hasText || /<hr\b/i.test(clean) ? clean : null;
}
