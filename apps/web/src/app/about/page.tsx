import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function AboutPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="ทำความรู้จัก BuddyBook" user={user}>
      <p>
        BuddyBook เป็นแพลตฟอร์มอ่าน-เขียนนิยายออนไลน์ ที่รวมเครื่องมือสำหรับนักเขียนไว้ครบในที่เดียว —
        ตั้งแต่ตัวแก้ไขบทความ ระบบจัดการตัวละคร แผนที่โลก และไทม์ไลน์เนื้อเรื่อง ไปจนถึงระบบแนะนำนิยาย
        ที่เรียนรู้จากความสนใจและพฤติกรรมการอ่านของแต่ละคน
      </p>
      <p>
        นักอ่านสามารถติดตามนิยายที่ชื่นชอบ เก็บไว้ในชั้นหนังสือส่วนตัว รีวิวและคอมเมนต์แต่ละตอน
        พร้อมสนับสนุนนักเขียนที่ชื่นชอบผ่านระบบ coin ได้โดยตรง ส่วนนักเขียนก็มีเครื่องมือติดตาม
        ยอดผู้อ่าน จัดการฉบับร่าง และดูตัวอย่างก่อนพิมพ์ได้ในที่เดียว
      </p>
      <p className="text-neutral-500">พัฒนาโดย Nannapat &amp; Montira</p>
    </InfoPage>
  );
}
