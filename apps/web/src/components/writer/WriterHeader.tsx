import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Breadcrumb + หัวข้อคงที่บนสุดของเครื่องมือ World-building ดู wf_settings_forms.png */
export function WriterHeader() {
  return (
    <div className="mb-5">
      <Link
        href="/write"
        className="mb-3 inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-primary-500"
      >
        กลับสู่หน้าหลัก
        <ChevronRight className="h-3.5 w-3.5" />
      </Link>
      <h1 className="text-h3 text-neutral-900">สร้างพล็อตนิยายสั้น ๆ ก่อนเริ่มเขียนจริงได้ที่นี่!</h1>
      <p className="mt-1 text-sm font-medium text-red-500">
        *เนื้อหาที่สร้างจะไม่ถูกนำไปเผยแพร่ในนิยาย
      </p>
    </div>
  );
}
