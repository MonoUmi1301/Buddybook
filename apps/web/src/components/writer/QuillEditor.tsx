"use client";

import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";

// เส้นคั่นฉาก (เปลี่ยน/จบเหตุการณ์) — Quill ไม่มีให้ในตัว จึงลงทะเบียน <hr class="scene-break"> เป็น block embed
// ทำครั้งเดียวตอนโหลดโมดูล (ฝั่ง client เท่านั้น — ไฟล์นี้ถูก dynamic import แบบ ssr: false)
const BlockEmbed = Quill.import("blots/block/embed") as unknown as { new (...args: unknown[]): object };
class SceneBreak extends BlockEmbed {
  static blotName = "divider";
  static tagName = "HR";
  static className = "scene-break";
}
Quill.register(SceneBreak as never, true);
const icons = Quill.import("ui/icons") as Record<string, string>;
icons.divider =
  '<svg viewBox="0 0 18 18"><line class="ql-stroke" x1="2" x2="16" y1="9" y2="9"></line>' +
  '<line class="ql-stroke ql-thin" x1="6" x2="12" y1="4" y2="4"></line>' +
  '<line class="ql-stroke ql-thin" x1="6" x2="12" y1="14" y2="14"></line></svg>';

interface QuillEditorProps {
  defaultValue?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  /** "chapter" = toolbar เต็มสำหรับเขียนตอน ; "basic" = จัดรูปแบบข้อความอย่างเดียว (แนะนำเรื่อง) ไม่มีรูป/วิดีโอ */
  variant?: "chapter" | "basic";
}

const BASIC_TOOLBAR = [
  ["bold", "italic", "underline", "strike"],
  [{ align: [] }],
  [{ list: "ordered" }, { list: "bullet" }],
  [{ color: [] }, { background: [] }],
  ["divider"],
  ["link"],
  ["clean"],
];

// Rich text editor สำหรับเขียนตอนนิยาย ใช้ quill ตรง ๆ (ไม่มี react-quill wrapper เป็น dependency)
// toolbar อ้างอิงจาก icon.pdf ในโฟลเดอร์ buddybook_real (กลุ่ม format ที่ Quill รองรับ built-in)
export function QuillEditor({ defaultValue = "", onChange, placeholder, variant = "chapter" }: QuillEditorProps) {
  // กล่องครอบที่ React ดูแล — ตัว editor และ toolbar ที่ Quill สร้างจะอยู่ข้างในนี้ทั้งหมด
  const wrapperRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);

  // audit fix — ปุ่มรูปเดิมไม่มี handler เอง ใช้พฤติกรรม default ของ Quill คือฝัง base64 ของไฟล์
  // ตรงใน content เลย ทำให้ payload บวมง่าย ๆ จนชน express.json limit 2mb (ตอบ 500/413 ตอนบันทึก)
  // ทั้งที่โปรเจกต์มี pipeline อัปโหลดรูปแบบ signed-Cloudinary อยู่แล้ว (ใช้กับปกนิยาย) — ใช้ตัวเดียวกัน
  // กับรูปที่แทรกในเนื้อหาแทน เก็บ upload fn ไว้ใน ref เพราะ effect ข้างล่างรันครั้งเดียวตอน mount
  // (ต้องอ่านค่าล่าสุดผ่าน ref ไม่ใช่ปิด closure ทับตัวแรกที่ mount)
  const { upload } = useCloudinaryUpload("chapters");
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || quillRef.current) return;

    // Quill แทรก toolbar เป็น "พี่น้อง" ไว้ก่อน element ที่ส่งให้ ถ้าส่ง div ที่ React render ตรง ๆ
    // toolbar จะไปค้างใน parent — พอ remount (เช่นกด "กู้คืนฉบับในเครื่อง" ที่เปลี่ยน key) toolbar เก่า
    // ไม่ถูกลบ เลยขึ้นซ้ำ 2 แถว จึงสร้าง div ให้ Quill เองภายใน wrapper แล้วล้างทิ้งทั้งหมดตอน unmount
    const editorEl = document.createElement("div");
    // chapter-indent: ย่อหน้าบรรทัดแรกให้เหมือนหน้าอ่าน (globals.css) — แค่การแสดงผล ไม่ใส่ช่องว่างลงในเนื้อหา
    // basic: กล่องเตี้ยกว่า (แนะนำเรื่อง) — ย่อหน้าบรรทัดแรกเหมือนตอนนิยาย
    editorEl.className = variant === "basic" ? "chapter-indent rich-basic min-h-[200px] bg-white" : "chapter-indent min-h-[400px] bg-white";
    wrapper.appendChild(editorEl);

    const quill = new Quill(editorEl, {
      theme: "snow",
      placeholder,
      modules: {
        toolbar: {
          container: variant === "basic" ? BASIC_TOOLBAR : [
            ["bold", "italic", "underline", "strike"],
            [{ script: "sub" }, { script: "super" }],
            ["blockquote"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            [{ align: [] }],
            [{ color: [] }, { background: [] }],
            ["divider"],
            ["link", "image", "video"],
            ["clean"],
          ],
          handlers: {
            // แทรกเส้นคั่นฉากใต้ย่อหน้าที่เคอร์เซอร์อยู่ (ไม่ตัดกลางย่อหน้า) แล้วย้ายเคอร์เซอร์ไปบรรทัดว่างใต้เส้น
            // ให้เขียนฉากใหม่ต่อได้ทันที — ถ้าอยู่บนบรรทัดว่าง เส้นจะขึ้นแทนที่บรรทัดนั้นแล้วเขียนต่อใต้เส้น
            divider: function dividerHandler(this: { quill: Quill }) {
              const quill = this.quill;
              const range = quill.getSelection(true);
              const [line, offset] = quill.getLine(range.index);
              const lineStart = range.index - offset;
              const lineLen = line ? line.length() : 1; // รวมตัวขึ้นบรรทัดใหม่
              let at: number;
              if (lineLen <= 1) {
                at = lineStart; // บรรทัดว่าง — เส้นขึ้นก่อนบรรทัดนี้ เคอร์เซอร์อยู่บรรทัดว่างใต้เส้น
              } else {
                at = lineStart + lineLen; // ต้นย่อหน้าถัดไป
                // ย่อหน้าสุดท้ายของตอน — เพิ่มบรรทัดว่างไว้ใต้เส้นให้เขียนต่อ
                if (at >= quill.getLength()) quill.insertText(at - 1, "\n", "user");
              }
              quill.insertEmbed(at, "divider", true, "user");
              quill.setSelection(at + 1, 0, "user");
            },
            image: function imageHandler(this: { quill: Quill }) {
              const range = this.quill.getSelection(true);
              const input = document.createElement("input");
              input.setAttribute("type", "file");
              input.setAttribute("accept", "image/*");
              input.onchange = async () => {
                const file = input.files?.[0];
                if (!file) return;
                const url = await uploadRef.current(file);
                if (url) {
                  this.quill.insertEmbed(range.index, "image", url, "user");
                  this.quill.setSelection(range.index + 1, 0);
                }
                // อัปโหลดไม่สำเร็จ — ไม่แทรกอะไร (useCloudinaryUpload เก็บ error message ไว้แล้ว
                // ถ้าต้องโชว์ UI แจ้งเตือนเพิ่มเติมในอนาคตค่อยต่อ callback จากตรงนี้)
              };
              input.click();
            },
          },
        },
      },
    });

    const dividerBtn = wrapper.querySelector("button.ql-divider");
    dividerBtn?.setAttribute("title", "เส้นคั่นฉาก (เปลี่ยน/จบเหตุการณ์)");
    dividerBtn?.setAttribute("aria-label", "เส้นคั่นฉาก");

    if (defaultValue) quill.clipboard.dangerouslyPasteHTML(defaultValue);
    quill.on("text-change", () => onChange?.(quill.root.innerHTML));
    quillRef.current = quill;

    return () => {
      quill.off("text-change");
      quillRef.current = null;
      wrapper.innerHTML = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // quill-sticky: แถบเครื่องมือติดขอบบนจอตอนเลื่อนลงไปเขียนท้าย ๆ ตอน ไม่ต้องเลื่อนกลับขึ้นไปบนสุด (globals.css)
  return <div ref={wrapperRef} className="quill-sticky" />;
}
