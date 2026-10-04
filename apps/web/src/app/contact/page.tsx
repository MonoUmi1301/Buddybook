import Link from "next/link";
import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function ContactPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="ติดต่อเรา" user={user}>
      <p>
        พบปัญหาการใช้งาน เติมเงิน/เหรียญ หรือเนื้อหา แจ้งทีมงานได้ที่{" "}
        <Link href="/support" className="font-medium text-primary-600 hover:underline">
          ศูนย์ช่วยเหลือ
        </Link>{" "}
        ทีมงานจะตอบกลับในเรื่องเดียวกันและส่งการแจ้งเตือนถึงคุณ
      </p>
      <p className="text-neutral-500">ต้องเข้าสู่ระบบก่อนแจ้งปัญหา เพื่อให้ทีมงานตรวจสอบบัญชีของคุณได้</p>
    </InfoPage>
  );
}
