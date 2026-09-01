/** การ์ด "ข้อมูลเบื้องต้น" ใน wf_novel_detail.png
 *  หมายเหตุ: เดิมมีบล็อกคำเตือนเนื้อหา (Content & Trigger Warning) แต่เป็นข้อความ hardcode
 *  ตัวเดียวกันทุกนิยาย (ไม่ตรงกับเนื้อหาจริงของแต่ละเรื่อง) และ schema ไม่มีคอลัมน์ให้นักเขียน
 *  ระบุคำเตือนจริงเลย จึงตัดออกแทนการโชว์คำเตือนปลอมที่อาจทำให้เข้าใจผิดว่านิยายทุกเรื่องมีเนื้อหา
 *  รุนแรง — ถ้าจะทำจริงต้องเพิ่มคอลัมน์ + UI ให้นักเขียนกรอกตอนสร้าง/แก้ไขนิยายก่อน */
export function ContentWarningCard({ synopsis }: { synopsis: string }) {
  return (
    <section className="rounded-card border border-neutral-200 bg-white p-6">
      <h2 className="mb-3 text-h3 text-neutral-900">ข้อมูลเบื้องต้น</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-neutral-700">
        {synopsis || "ยังไม่มีเรื่องย่อ"}
      </p>
    </section>
  );
}
