"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { PrintButton } from "@/components/writer/PrintButton";

/** พรีวิวหน้ากระดาษก่อนตีพิมพ์แบบหนังสือพลิกหน้าได้ (requirement ข้อ 8 — "เลือกหน้ากระดาษขนาด A2
 *  แล้วดูได้จะเป็นยังไง") เขียนเองด้วย React + CSS 3D ไม่ใช้ไลบรารีภายนอก
 *  - แบ่งหน้าจริงตามขนาดกระดาษ/ฟอนต์ที่เลือก โดยวัดความสูงข้อความใน DOM (ตัดคำไทยด้วย Intl.Segmenter)
 *  - ลากมุมกระดาษเพื่อพลิกหน้า หรือคลิก/กดปุ่มลูกศร/คีย์บอร์ด ← →
 *  - จอกว้างแสดงเป็นหน้าคู่ (spread) จอแคบแสดงทีละหน้า
 *  - กดพิมพ์ได้กระดาษตามขนาดที่เลือก (@page size) */

const PX_PER_MM = 96 / 25.4;

const PAPER_SIZES = [
  { id: "A6", label: "A6 · พ็อกเก็ตบุ๊ก", w: 105, h: 148 },
  { id: "B6", label: "B6 · นิยายเล่มเล็ก", w: 128, h: 182 },
  { id: "A5", label: "A5 · นิยายทั่วไป", w: 148, h: 210 },
  { id: "B5", label: "B5", w: 176, h: 250 },
  { id: "A4", label: "A4", w: 210, h: 297 },
  { id: "A3", label: "A3", w: 297, h: 420 },
  { id: "A2", label: "A2", w: 420, h: 594 },
] as const;
type PaperId = (typeof PAPER_SIZES)[number]["id"];

const FONT_SIZES = [
  { id: "s", label: "เล็ก", pt: 10 },
  { id: "m", label: "กลาง", pt: 12 },
  { id: "l", label: "ใหญ่", pt: 14 },
] as const;
type FontSizeId = (typeof FONT_SIZES)[number]["id"];

const FONTS = [
  { id: "sarabun", label: "Sarabun", css: "var(--font-sarabun), sans-serif" },
  { id: "serif", label: "Noto Serif Thai", css: "var(--font-noto-serif-thai), serif" },
] as const;
type FontId = (typeof FONTS)[number]["id"];

// สีกระดาษ/ตัวอักษรใส่ค่าตรง ๆ ไม่ใช้ token ของธีม — กระดาษต้องเป็นสีขาวเสมอแม้เปิด dark mode
const PAPER_BG = "#fffdf8";
const INK = "#262421";

export interface BookPreviewData {
  novel: { novel_id: string; title: string; synopsis: string | null; authorName: string; coverUrl: string | null };
  chapters: { chapter_number: number; title: string; content: string | null }[];
}

type BookPage =
  | { kind: "cover" }
  /** ปกใน — ชื่อเรื่อง/ผู้แต่ง/เรื่องย่อ (มีเฉพาะเมื่อมีรูปปก ไม่งั้นข้อมูลนี้อยู่บนหน้าปกแทน) */
  | { kind: "title" }
  | { kind: "text"; heading?: string; blocks: string[]; number: number };

/** ช่องแสดงผลในโหมดหน้าคู่ — "none" = ไม่มีกระดาษ (ซ้ายของปกหน้า), "blank" = กระดาษเปล่า */
type Slot = BookPage | "none" | "blank";

interface Layout {
  pageW: number; // px (96dpi) ขนาดจริงของกระดาษ
  pageH: number;
  marginX: number;
  marginTop: number;
  marginBottom: number;
  fontCss: string;
  fontPx: number;
}

const LINE_HEIGHT = 1.8;

function makeLayout(paperId: PaperId, fontSizeId: FontSizeId, fontId: FontId): Layout {
  const paper = PAPER_SIZES.find((p) => p.id === paperId) ?? PAPER_SIZES[2];
  const pt = FONT_SIZES.find((f) => f.id === fontSizeId)?.pt ?? 12;
  const marginMm = Math.max(12, Math.round(paper.w * 0.12));
  return {
    pageW: paper.w * PX_PER_MM,
    pageH: paper.h * PX_PER_MM,
    marginX: marginMm * PX_PER_MM,
    marginTop: marginMm * PX_PER_MM,
    // ขอบล่างเผื่อที่ให้เลขหน้า
    marginBottom: (marginMm + 6) * PX_PER_MM,
    fontCss: FONTS.find((f) => f.id === fontId)?.css ?? FONTS[0].css,
    fontPx: (pt * 96) / 72,
  };
}

const headingStyle: CSSProperties = { fontSize: "1.35em", fontWeight: 700, lineHeight: 1.5, margin: "0 0 1.2em" };

// สไตล์ของเนื้อหา (HTML จาก Quill) — ใช้คลาสเดียวกันทั้งกล่องวัดและหน้ากระดาษจริง ไม่งั้นแบ่งหน้าเพี้ยน
const CONTENT_CSS = `
.bp-content { display: flow-root; overflow-wrap: anywhere; }
.bp-content p { margin: 0; text-indent: 2em; }
.bp-content p.ql-align-center, .bp-content p.ql-align-right, .bp-content p.bp-cont,
.bp-content :is(h1, h2, h3, h4, h5, h6) + p, .bp-content blockquote p { text-indent: 0; }
.bp-content h1 { font-size: 1.6em; font-weight: 700; line-height: 1.4; margin: 0.6em 0; }
.bp-content h2 { font-size: 1.35em; font-weight: 700; line-height: 1.4; margin: 0.6em 0; }
.bp-content h3, .bp-content h4, .bp-content h5, .bp-content h6 { font-size: 1.15em; font-weight: 700; margin: 0.5em 0; }
.bp-content blockquote { margin: 0.4em 0; padding-left: 1em; border-left: 3px solid #d6d3d1; opacity: 0.85; }
.bp-content pre { margin: 0.4em 0; white-space: pre-wrap; font-size: 0.9em; }
.bp-content strong, .bp-content b { font-weight: 700; }
.bp-content em, .bp-content i { font-style: italic; }
.bp-content u { text-decoration: underline; }
.bp-content s { text-decoration: line-through; }
.bp-content a { color: inherit; text-decoration: underline; }
.bp-content img { display: block; max-width: 100%; height: auto; margin: 0.5em auto; }
.bp-content hr { border: 0; border-top: 1px solid currentColor; opacity: 0.35; margin: 1em 0; }
.bp-content hr + p { text-indent: 0; }
.bp-content .bp-li { padding-left: 1.4em; text-indent: -1.1em; }
.bp-content .ql-align-center { text-align: center; }
.bp-content .ql-align-right { text-align: right; }
.bp-content .ql-align-justify { text-align: justify; }
`;

function textStyle(layout: Layout): CSSProperties {
  return { fontFamily: layout.fontCss, fontSize: layout.fontPx, lineHeight: LINE_HEIGHT, color: INK };
}

// ---------- การแบ่งหน้า ----------

function segmentText(text: string): string[] {
  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const seg = new Intl.Segmenter("th", { granularity: "word" });
    return Array.from(seg.segment(text), (s) => s.segment);
  }
  return Array.from(text);
}

const ALLOWED_TAGS = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "S", "SPAN", "A", "SUB", "SUP", "CODE", "PRE",
  "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "IMG", "UL", "OL", "LI", "HR",
]);
const DROP_TAGS = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT"]);
const BLOCK_TAGS = new Set(["P", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "PRE", "HR"]);

/** กรอง HTML ของเนื้อหาให้เหลือแท็กจัดรูปแบบที่รู้จัก (ตัด script / event handler / style ออก) */
function sanitize(root: Element) {
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (!el.isConnected) continue;
    if (DROP_TAGS.has(el.tagName) || el.classList.contains("ql-ui")) {
      el.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      const keep =
        name === "class" ||
        name === "alt" ||
        name === "data-list" ||
        (name === "href" && /^(https?:|mailto:|\/|#)/.test(value)) ||
        (name === "src" && /^(https?:|data:image\/|\/)/.test(value));
      if (!keep) el.removeAttribute(attr.name);
    }
  }
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** แปลงเนื้อหาตอนเป็นรายการ block (ย่อหน้า/หัวข้อ/ข้อในลิสต์) ที่เอาไปเรียงลงหน้ากระดาษทีละอัน
 *  รองรับทั้ง HTML จาก Quill และข้อความธรรมดา (ข้อมูลเก่า) — ลิสต์ถูกแตกเป็นทีละข้อเพื่อให้ตัดข้ามหน้าได้ */
function toBlocks(content: string): Element[] {
  const html = /<[a-z][\s\S]*>/i.test(content)
    ? content
    : content
        .replace(/\r\n?/g, "\n")
        .split("\n")
        .map((line) => `<p>${line ? escapeHtml(line) : "<br>"}</p>`)
        .join("");
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstElementChild as Element;
  sanitize(root);

  const blocks: Element[] = [];
  let inline: Element | null = null; // รวม text/inline ที่อยู่ลอย ๆ ระดับบนสุดเป็นย่อหน้าเดียว
  for (const node of Array.from(root.childNodes)) {
    const el = node.nodeType === 1 ? (node as Element) : null;
    if (el && (el.tagName === "UL" || el.tagName === "OL")) {
      inline = null;
      let n = 1;
      for (const li of Array.from(el.children)) {
        const p = doc.createElement("p");
        p.className = `${li.className} bp-li`.trim();
        const bullet = el.tagName === "UL" || li.getAttribute("data-list") === "bullet";
        p.append(bullet ? "• " : `${n++}. `, ...Array.from(li.childNodes));
        blocks.push(p);
      }
    } else if (el && BLOCK_TAGS.has(el.tagName)) {
      inline = null;
      blocks.push(el);
    } else if (node.nodeType === 1 || (node.nodeType === 3 && node.textContent?.trim())) {
      if (!inline) {
        inline = doc.createElement("p");
        blocks.push(inline);
      }
      inline.append(node);
    }
  }
  return blocks;
}

/** ตัด block เอาเฉพาะตัวอักษรช่วง [start, end) โดยคงแท็กจัดรูปแบบ (ตัวหนา/เอียง ฯลฯ) ไว้ */
function sliceBlock(el: Element, start: number, end: number): Element {
  const clone = el.cloneNode(true) as Element;
  const walker = document.createTreeWalker(clone, NodeFilter.SHOW_TEXT);
  const texts: Text[] = [];
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  let pos = 0;
  for (const t of texts) {
    const len = t.data.length;
    const s = Math.max(start - pos, 0);
    const e = Math.min(end - pos, len);
    t.data = e <= 0 || s >= len ? "" : t.data.slice(s, e);
    pos += len;
  }
  // รูปอยู่กับท่อนแรกเท่านั้น ท่อนต่อไม่ต้องมีรูปซ้ำ
  if (start > 0) clone.querySelectorAll("img").forEach((img) => img.remove());
  return clone;
}

const isEmptyBlock = (el: Element) => !el.textContent?.trim() && !el.querySelector("img");

/** โหลดรูปในเนื้อหาให้เสร็จก่อนวัด (ไม่งั้นความสูงรูปเป็น 0 ตอนแบ่งหน้า) — รอไม่เกิน 4 วินาที */
async function preloadImages(blocksByChapter: Element[][]) {
  const srcs = new Set<string>();
  for (const blocks of blocksByChapter) {
    for (const b of blocks) {
      b.querySelectorAll("img").forEach((img) => {
        const src = img.getAttribute("src");
        if (src) srcs.add(src);
      });
    }
  }
  if (srcs.size === 0) return;
  const loads = Array.from(
    srcs,
    (src) =>
      new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = src;
      })
  );
  await Promise.race([Promise.all(loads), new Promise((r) => setTimeout(r, 4000))]);
}

function paginate(measure: HTMLDivElement, layout: Layout, chapters: { heading: string; blocks: Element[] }[]): BookPage[] {
  const contentH = layout.pageH - layout.marginTop - layout.marginBottom;
  const pages: BookPage[] = [];
  let number = 1;
  const fits = () => measure.scrollHeight <= contentH + 0.5;

  for (const ch of chapters) {
    let page: { heading?: string; blocks: string[] } = { heading: ch.heading, blocks: [] };
    let body = document.createElement("div");

    const resetMeasure = (heading?: string) => {
      measure.innerHTML = "";
      if (heading) {
        const h = document.createElement("h2");
        Object.assign(h.style, headingStyle);
        h.textContent = heading;
        measure.appendChild(h);
      }
      body = document.createElement("div");
      measure.appendChild(body);
    };
    const flush = () => {
      pages.push({ kind: "text", heading: page.heading, blocks: page.blocks, number: number++ });
      page = { blocks: [] };
      resetMeasure();
    };
    resetMeasure(ch.heading);

    const queue = [...ch.blocks];
    while (queue.length > 0) {
      const block = queue.shift() as Element;
      const isNewPage = !page.heading && page.blocks.length === 0;
      // บรรทัดว่างที่ตกมาต้นหน้าใหม่ไม่ต้องแสดง (ดูเหมือนหน้าเว้นว่างด้านบน)
      if (isNewPage && isEmptyBlock(block)) continue;

      let node = block.cloneNode(true) as Element;
      body.appendChild(node);
      if (fits()) {
        page.blocks.push(node.outerHTML);
        continue;
      }

      // ล้นหน้า — หาจำนวนคำมากสุดที่ยังใส่ได้ในหน้านี้ (binary search) ที่เหลือยกไปหน้าถัดไป
      const text = block.textContent ?? "";
      const offsets = [0];
      for (const seg of segmentText(text)) offsets.push(offsets[offsets.length - 1] + seg.length);
      let lo = 0;
      let hi = offsets.length - 1;
      while (lo < hi) {
        const mid = Math.ceil((lo + hi) / 2);
        const part = sliceBlock(block, 0, offsets[mid]);
        body.replaceChild(part, node);
        node = part;
        if (fits()) lo = mid;
        else hi = mid - 1;
      }

      // หน้าเปล่าแต่ใส่ไม่ได้แม้แต่คำเดียว (เช่น รูปสูงกว่าหน้า) — ใส่ไปทั้งก้อน กันวนไม่จบ
      if (lo === 0 && isNewPage) lo = offsets.length - 1;

      if (lo > 0) {
        page.blocks.push(sliceBlock(block, 0, offsets[lo]).outerHTML);
        const rest = text.slice(offsets[lo]);
        if (rest.trim()) {
          // ส่วนที่ยกไปหน้าถัดไปเป็นย่อหน้าเดิมที่ต่อมา — ไม่ย่อหน้าบรรทัดแรกซ้ำ
          const cont = sliceBlock(block, offsets[lo] + (rest.length - rest.trimStart().length), text.length);
          cont.classList.add("bp-cont");
          queue.unshift(cont);
        }
      } else {
        queue.unshift(block);
      }
      flush();
    }
    if (page.heading || page.blocks.length > 0) flush();
  }
  measure.innerHTML = "";
  return pages;
}

// ---------- หน้ากระดาษ ----------

function PageSheet({ slot, layout, data, className, style, children }: {
  slot: Slot;
  layout: Layout;
  data: BookPreviewData;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}) {
  if (slot === "none") return <div className={className} style={{ width: layout.pageW, height: layout.pageH, ...style }} />;

  return (
    <div
      // ตำแหน่งแบบ absolute ต้องส่งผ่าน style (inline ชนะคลาส) — ถ้าส่ง className="absolute" จะแพ้
      // "relative" ด้านล่างตามลำดับ CSS ของ Tailwind ทำให้ด้านหน้า/หลังของกระดาษที่พลิกไม่ซ้อนกัน
      className={cn("relative overflow-hidden", className)}
      style={{ width: layout.pageW, height: layout.pageH, background: PAPER_BG, ...style }}
    >
      {slot !== "blank" && slot.kind === "cover" && data.novel.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- รูปปกจาก Cloudinary แสดงเต็มหน้า ใช้ได้ทั้งจอและตอนพิมพ์
        <img src={data.novel.coverUrl} alt={`ปก ${data.novel.title}`} className="h-full w-full object-cover" draggable={false} />
      )}
      {slot !== "blank" && (slot.kind === "title" || (slot.kind === "cover" && !data.novel.coverUrl)) && (
        <div
          className="flex h-full flex-col items-center justify-center text-center"
          style={{ ...textStyle(layout), padding: `${layout.marginTop}px ${layout.marginX}px` }}
        >
          <h1 style={{ fontSize: "2.2em", fontWeight: 700, lineHeight: 1.35, margin: 0 }}>{data.novel.title}</h1>
          <p style={{ marginTop: "1em", fontSize: "1.1em" }}>{data.novel.authorName}</p>
          {data.novel.synopsis && (
            <p className="line-clamp-[12]" style={{ marginTop: "2.5em", fontSize: "0.9em", opacity: 0.75, whiteSpace: "pre-wrap" }}>
              {data.novel.synopsis}
            </p>
          )}
        </div>
      )}
      {slot !== "blank" && slot.kind === "text" && (
        <>
          <div
            className="bp-content"
            style={{
              ...textStyle(layout),
              position: "absolute",
              top: layout.marginTop,
              left: layout.marginX,
              right: layout.marginX,
              bottom: layout.marginBottom,
            }}
          >
            {slot.heading && <h2 style={headingStyle}>{slot.heading}</h2>}
            {/* HTML ผ่าน sanitize() แล้วใน toBlocks */}
            <div dangerouslySetInnerHTML={{ __html: slot.blocks.join("") }} />
          </div>
          <span
            className="absolute inset-x-0 text-center"
            style={{ bottom: layout.marginBottom / 2.4, fontFamily: layout.fontCss, fontSize: layout.fontPx * 0.8, color: INK, opacity: 0.6 }}
          >
            {slot.number}
          </span>
        </>
      )}
      {children}
    </div>
  );
}

// ---------- ตัวหนังสือพลิกหน้า ----------

interface FlipState {
  dir: 1 | -1;
  progress: number; // 0 = ยังไม่พลิก, 1 = พลิกเสร็จ
  animating: boolean;
}

const FLIP_MS = 550;

export function BookPreview({ data, backHref }: { data: BookPreviewData; backHref: string }) {
  const [paperId, setPaperId] = useState<PaperId>("A5");
  const [fontSizeId, setFontSizeId] = useState<FontSizeId>("m");
  const [fontId, setFontId] = useState<FontId>("sarabun");
  const layout = makeLayout(paperId, fontSizeId, fontId);

  const measureRef = useRef<HTMLDivElement>(null);
  const [textPages, setTextPages] = useState<BookPage[] | null>(null);
  const pages: BookPage[] = textPages
    ? [{ kind: "cover" }, ...(data.novel.coverUrl ? [{ kind: "title" } as BookPage] : []), ...textPages]
    : [];

  // ---- แบ่งหน้าใหม่ทุกครั้งที่เปลี่ยนขนาดกระดาษ/ฟอนต์ (รอฟอนต์โหลดก่อน ไม่งั้นวัดผิด) ----
  const positionRef = useRef(0); // สัดส่วนตำแหน่งที่อ่านอยู่ (0-1) ไว้คงตำแหน่งหลังจัดหน้าใหม่
  useEffect(() => {
    let cancelled = false;
    setTextPages(null);
    void (async () => {
      try {
        await document.fonts?.ready;
      } catch {
        // ไม่รองรับ document.fonts — แบ่งหน้าได้เลย
      }
      const chapters = data.chapters.map((ch) => ({
        heading: `ตอนที่ ${ch.chapter_number}: ${ch.title}`,
        blocks: toBlocks(ch.content && (ch.content.replace(/<[^>]*>/g, "").trim() || /<img/i.test(ch.content)) ? ch.content : "(ยังไม่มีเนื้อหา)"),
      }));
      await preloadImages(chapters.map((c) => c.blocks));
      if (cancelled || !measureRef.current) return;
      const result = paginate(measureRef.current, makeLayout(paperId, fontSizeId, fontId), chapters);
      if (!cancelled) setTextPages(result);
    })();
    return () => {
      cancelled = true;
    };
  }, [paperId, fontSizeId, fontId, data.chapters]);

  // ---- ขนาดพื้นที่แสดงผล: หน้าคู่หรือหน้าเดียว + scale ให้พอดีจอ ----
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const update = () => setStage({ w: el.clientWidth, h: window.innerHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);

  const spread = stage.w >= 640;
  const bookW = spread ? layout.pageW * 2 : layout.pageW;
  const maxH = Math.max(320, stage.h * 0.72);
  const scale = stage.w > 0 ? Math.min((stage.w - 8) / bookW, maxH / layout.pageH, 1.5) : 0;

  // ---- ตำแหน่งปัจจุบัน ----
  // หน้าคู่: slots = [ไม่มีกระดาษ, ปก, หน้า 1, ...] เติมกระดาษเปล่าท้ายให้ครบคู่ — spreadIndex ชี้คู่ที่เปิดอยู่
  // หน้าเดียว: pageIndex ชี้หน้าใน pages
  const slots: Slot[] = ["none", ...pages];
  if (slots.length % 2 === 1) slots.push("blank");
  const spreadCount = slots.length / 2;

  const [index, setIndex] = useState(0);
  const maxIndex = spread ? spreadCount - 1 : pages.length - 1;
  const current = Math.min(index, Math.max(0, maxIndex));

  // คงตำแหน่งตอนจัดหน้าใหม่/สลับหน้าคู่-หน้าเดียว
  useEffect(() => {
    if (!textPages) return;
    const total = spread ? spreadCount - 1 : pages.length - 1;
    setIndex(Math.round(positionRef.current * Math.max(0, total)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [textPages, spread]);
  useEffect(() => {
    if (maxIndex > 0) positionRef.current = current / maxIndex;
  }, [current, maxIndex]);

  const canNext = current < maxIndex;
  const canPrev = current > 0;

  // ---- การพลิกหน้า ----
  const [flip, setFlip] = useState<FlipState | null>(null);
  const flipRef = useRef<FlipState | null>(null);
  flipRef.current = flip;
  const timerRef = useRef<number | null>(null);

  const finishFlip = useCallback((dir: 1 | -1, complete: boolean) => {
    setFlip((f) => (f ? { ...f, progress: complete ? 1 : 0, animating: true } : f));
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      if (complete) setIndex((i) => i + dir);
      setFlip(null);
    }, FLIP_MS);
  }, []);

  const startFlip = useCallback(
    (dir: 1 | -1) => {
      if (flipRef.current) return;
      if (dir === 1 ? !canNext : !canPrev) return;
      setFlip({ dir, progress: 0, animating: false });
      // รอให้เฟรมแรก (ยังไม่พลิก) วาดก่อน แล้วค่อยใส่ transition ไปจนสุด
      requestAnimationFrame(() => requestAnimationFrame(() => finishFlip(dir, true)));
    },
    [canNext, canPrev, finishFlip]
  );

  useEffect(() => () => {
    if (timerRef.current) window.clearTimeout(timerRef.current);
  }, []);

  // คีย์บอร์ด ← →
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "ArrowRight") startFlip(1);
      if (e.key === "ArrowLeft") startFlip(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [startFlip]);

  // ลากพลิก: กดครึ่งขวา = พลิกไปหน้าถัดไป, ครึ่งซ้าย = ย้อนกลับ ลากเกิน 30% แล้วปล่อยจะพลิกต่อจนสุด
  const dragRef = useRef<{ startX: number; dir: 1 | -1; moved: boolean; width: number } | null>(null);

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (flipRef.current || !textPages) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const dir: 1 | -1 = e.clientX - rect.left > rect.width / 2 ? 1 : -1;
    if (dir === 1 ? !canNext : !canPrev) return;
    dragRef.current = { startX: e.clientX, dir, moved: false, width: (spread ? rect.width : rect.width * 1.2) * 0.85 };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dx) < 5) return;
    d.moved = true;
    const progress = Math.min(1, Math.max(0, (d.dir === 1 ? -dx : dx) / d.width));
    setFlip({ dir: d.dir, progress, animating: false });
  }

  function onPointerUp() {
    const d = dragRef.current;
    dragRef.current = null;
    if (!d) return;
    if (!d.moved) {
      startFlip(d.dir);
      return;
    }
    const f = flipRef.current;
    finishFlip(d.dir, (f?.progress ?? 0) > 0.3);
  }

  // ---- คำนวณสิ่งที่ต้องวาด ----
  let under: { left?: Slot; right?: Slot; single?: Slot };
  let leaf: { front: Slot; back: Slot; angle: number } | null = null;

  if (spread) {
    const s = current;
    if (flip && flip.dir === 1) {
      under = { left: slots[2 * s], right: slots[2 * s + 3] ?? "none" };
      leaf = { front: slots[2 * s + 1], back: slots[2 * s + 2] ?? "blank", angle: -180 * flip.progress };
    } else if (flip && flip.dir === -1) {
      under = { left: slots[2 * s - 2] ?? "none", right: slots[2 * s + 1] };
      leaf = { front: slots[2 * s - 1], back: slots[2 * s], angle: -180 * (1 - flip.progress) };
    } else {
      under = { left: slots[2 * s], right: slots[2 * s + 1] };
    }
  } else {
    const k = current;
    if (flip && flip.dir === 1) {
      under = { single: pages[k + 1] ?? "blank" };
      leaf = { front: pages[k], back: "blank", angle: -180 * flip.progress };
    } else if (flip && flip.dir === -1) {
      under = { single: pages[k] };
      leaf = { front: pages[k - 1], back: "blank", angle: -180 * (1 - flip.progress) };
    } else {
      under = { single: pages[k] };
    }
  }

  // เงาบนกระดาษที่กำลังพลิก — เข้มสุดตอนตั้งฉาก (90°)
  const shade = leaf ? Math.sin((Math.abs(leaf.angle) * Math.PI) / 180) * 0.28 : 0;

  // ข้อความบอกตำแหน่งหน้า
  let positionLabel = "";
  if (textPages) {
    const pageLabel = (slot: Slot | undefined) =>
      slot && slot !== "none" && slot !== "blank"
        ? slot.kind === "cover"
          ? "ปก"
          : slot.kind === "title"
            ? "ปกใน"
            : String(slot.number)
        : null;
    const labels = spread
      ? [pageLabel(slots[2 * current]), pageLabel(slots[2 * current + 1])].filter(Boolean)
      : [pageLabel(pages[current])].filter(Boolean);
    positionLabel = `${labels.join("–")} / ${textPages.length} หน้า`;
  }

  const paper = PAPER_SIZES.find((p) => p.id === paperId) ?? PAPER_SIZES[2];

  return (
    <div className="min-h-screen bg-neutral-100 print:bg-white">
      {/* แถบเครื่องมือ */}
      <div className="print:hidden sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 sm:px-6">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-neutral-900">
          <ArrowLeft className="h-4 w-4" />
          กลับไปแก้ไข
        </Link>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-neutral-500">
            ขนาดกระดาษ
            <select
              value={paperId}
              onChange={(e) => setPaperId(e.target.value as PaperId)}
              className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-800"
            >
              {PAPER_SIZES.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label} ({p.w}×{p.h} มม.)
                </option>
              ))}
            </select>
          </label>

          <select
            value={fontId}
            onChange={(e) => setFontId(e.target.value as FontId)}
            aria-label="ฟอนต์"
            className="h-9 rounded-lg border border-neutral-300 bg-white px-2 text-sm text-neutral-800"
          >
            {FONTS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>

          <div className="flex overflow-hidden rounded-lg border border-neutral-300" role="group" aria-label="ขนาดตัวอักษร">
            {FONT_SIZES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFontSizeId(f.id)}
                className={cn(
                  "h-9 px-3 text-sm transition-colors",
                  fontSizeId === f.id ? "bg-primary-500 text-white" : "bg-white text-neutral-600 hover:bg-neutral-50"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          <PrintButton />
        </div>
      </div>

      {/* หนังสือ */}
      <div className="print:hidden px-4 py-6 sm:px-6">
        <div ref={stageRef} className="mx-auto flex max-w-6xl flex-col items-center">
          {!textPages || scale === 0 ? (
            <div className="flex h-96 items-center justify-center gap-2 text-sm text-neutral-500">
              <Loader2 className="h-4 w-4 animate-spin" /> กำลังจัดหน้ากระดาษ…
            </div>
          ) : (
            <>
              <div style={{ width: bookW * scale, height: layout.pageH * scale }}>
                <div
                  className="relative cursor-grab touch-none select-none active:cursor-grabbing"
                  style={{
                    width: bookW,
                    height: layout.pageH,
                    transform: `scale(${scale})`,
                    transformOrigin: "top left",
                    perspective: layout.pageW * 4,
                  }}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                >
                  {/* หน้าที่อยู่ข้างใต้ */}
                  {spread ? (
                    <div className="flex">
                      <PageSheet slot={under.left ?? "none"} layout={layout} data={data} style={sheetShadow(under.left)}>
                        <div className="pointer-events-none absolute inset-y-0 right-0 w-1/6" style={{ background: "linear-gradient(to left, rgba(0,0,0,0.12), transparent)" }} />
                      </PageSheet>
                      <PageSheet slot={under.right ?? "none"} layout={layout} data={data} style={sheetShadow(under.right)}>
                        <div className="pointer-events-none absolute inset-y-0 left-0 w-1/6" style={{ background: "linear-gradient(to right, rgba(0,0,0,0.12), transparent)" }} />
                      </PageSheet>
                    </div>
                  ) : (
                    <PageSheet slot={under.single ?? "blank"} layout={layout} data={data} style={sheetShadow(under.single)} />
                  )}

                  {/* กระดาษที่กำลังพลิก — หมุนรอบสันหนังสือ */}
                  {leaf && (
                    <div
                      className="absolute top-0"
                      style={{
                        left: spread ? layout.pageW : 0,
                        width: layout.pageW,
                        height: layout.pageH,
                        transformOrigin: "left center",
                        transformStyle: "preserve-3d",
                        transform: `rotateY(${leaf.angle}deg)`,
                        transition: flip?.animating ? `transform ${FLIP_MS}ms cubic-bezier(0.3, 0.7, 0.4, 1)` : "none",
                        zIndex: 10,
                      }}
                    >
                      <PageSheet
                        slot={leaf.front}
                        layout={layout}
                        data={data}
                        style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", boxShadow: "0 0 12px rgba(0,0,0,0.15)" }}
                      >
                        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to left, rgba(0,0,0,${shade}), transparent 55%)` }} />
                      </PageSheet>
                      <PageSheet
                        slot={leaf.back === "none" ? "blank" : leaf.back}
                        layout={layout}
                        data={data}
                        style={{
                          position: "absolute",
                          inset: 0,
                          backfaceVisibility: "hidden",
                          transform: "rotateY(180deg)",
                          boxShadow: "0 0 12px rgba(0,0,0,0.15)",
                        }}
                      >
                        <div className="pointer-events-none absolute inset-0" style={{ background: `linear-gradient(to right, rgba(0,0,0,${shade}), transparent 55%)` }} />
                      </PageSheet>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => startFlip(-1)}
                  disabled={!canPrev}
                  aria-label="หน้าก่อนหน้า"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <span className="min-w-28 text-center text-sm text-neutral-600">{positionLabel}</span>
                <button
                  type="button"
                  onClick={() => startFlip(1)}
                  disabled={!canNext}
                  aria-label="หน้าถัดไป"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-300 bg-white text-neutral-600 transition-colors hover:bg-neutral-50 disabled:opacity-40"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-neutral-400">
                {paper.id} · {paper.w}×{paper.h} มม. · ลากมุมกระดาษหรือกด ← → เพื่อพลิกหน้า
              </p>
            </>
          )}
        </div>
      </div>

      {/* ฉบับพิมพ์ — แสดงเฉพาะตอนสั่งพิมพ์ ทีละหน้าตามขนาดกระดาษที่เลือก */}
      {textPages && (
        <div className="hidden print:block">
          <style>{`@page { size: ${paper.w}mm ${paper.h}mm; margin: 0; }`}</style>
          {pages.map((page, i) => (
            <PageSheet key={i} slot={page} layout={layout} data={data} style={{ breakAfter: i < pages.length - 1 ? "page" : "auto", background: "#fff" }} />
          ))}
        </div>
      )}

      {/* กล่องวัดความสูงข้อความสำหรับแบ่งหน้า (มองไม่เห็น) */}
      <style>{CONTENT_CSS}</style>
      <div
        ref={measureRef}
        aria-hidden
        className="bp-content print:hidden"
        style={{
          ...textStyle(layout),
          position: "fixed",
          left: -100000,
          top: 0,
          visibility: "hidden",
          width: layout.pageW - layout.marginX * 2,
        }}
      />
    </div>
  );
}

function sheetShadow(slot: Slot | undefined): CSSProperties | undefined {
  return slot && slot !== "none" ? { boxShadow: "0 2px 10px rgba(0,0,0,0.12)" } : undefined;
}
