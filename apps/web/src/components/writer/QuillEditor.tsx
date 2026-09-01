"use client";

import { useEffect, useRef } from "react";
import Quill from "quill";
import "quill/dist/quill.snow.css";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";

interface QuillEditorProps {
  defaultValue?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

// Rich text editor สำหรับเขียนตอนนิยาย ใช้ quill ตรง ๆ (ไม่มี react-quill wrapper เป็น dependency)
// toolbar อ้างอิงจาก icon.pdf ในโฟลเดอร์ buddybook_real (กลุ่ม format ที่ Quill รองรับ built-in)
export function QuillEditor({ defaultValue = "", onChange, placeholder }: QuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    if (!containerRef.current || quillRef.current) return;

    const quill = new Quill(containerRef.current, {
      theme: "snow",
      placeholder,
      modules: {
        toolbar: {
          container: [
            ["bold", "italic", "underline", "strike"],
            [{ script: "sub" }, { script: "super" }],
            ["blockquote"],
            [{ list: "ordered" }, { list: "bullet" }],
            [{ indent: "-1" }, { indent: "+1" }],
            [{ align: [] }],
            [{ color: [] }, { background: [] }],
            ["link", "image", "video"],
            ["clean"],
          ],
          handlers: {
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

    if (defaultValue) quill.clipboard.dangerouslyPasteHTML(defaultValue);
    quill.on("text-change", () => onChange?.(quill.root.innerHTML));
    quillRef.current = quill;

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="min-h-[400px] bg-white" />;
}
