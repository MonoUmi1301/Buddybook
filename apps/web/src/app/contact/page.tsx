import Link from "next/link";
import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="ติดต่อเรา" user={user}>
      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">หาคำตอบด้วยตัวเอง</h2>
        <p>
          คำถามที่เจอบ่อย เช่น การเติม coin การซื้อตอน หรือการตั้งเวลาเผยแพร่ ดูได้ที่{" "}
          <Link href="/faq" className="font-medium text-primary-600 hover:underline">
            คำถามที่พบบ่อย
          </Link>{" "}
          และ{" "}
          <Link href="/guide" className="font-medium text-primary-600 hover:underline">
            คู่มือการใช้งาน
          </Link>
        </p>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">แจ้งปัญหากับทีมงาน</h2>
        <p>
          พบปัญหาการใช้งาน เติมเงิน/เหรียญ หรือเนื้อหา แจ้งทีมงานได้ที่{" "}
          <Link href="/support#ticket" className="font-medium text-primary-600 hover:underline">
            ศูนย์ช่วยเหลือ
          </Link>{" "}
          ทีมงานจะตอบกลับในเรื่องเดียวกันและส่งการแจ้งเตือนถึงคุณ
        </p>
        <p className="mt-1 text-neutral-500">ต้องเข้าสู่ระบบก่อนแจ้งปัญหา เพื่อให้ทีมงานตรวจสอบบัญชีของคุณได้</p>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">รายงานเนื้อหาไม่เหมาะสม</h2>
        <p>กดปุ่ม &quot;รายงาน&quot; ที่หน้าอ่านตอนนั้น ๆ ทีมงานจะตรวจสอบและดำเนินการตามเงื่อนไขการใช้บริการ</p>
      </div>
      <div>
        <h2 className="mb-1 text-sm font-semibold text-neutral-900">ผู้พัฒนา</h2>
        <p>BuddyBook พัฒนาโดย Nannapat &amp; Montira</p>
      </div>
    </InfoPage>
  );
}
