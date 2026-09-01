import { InfoPage } from "@/components/info/InfoPage";
import { getCurrentUser } from "@/lib/api/session";

export default async function TermsPage() {
  const user = await getCurrentUser();
  return (
    <InfoPage title="เงื่อนไขการใช้บริการ" user={user}>
      <p>เอกสารเงื่อนไขการใช้บริการฉบับทางการยังอยู่ระหว่างจัดเตรียมและตรวจสอบทางกฎหมาย</p>
      <p className="text-neutral-500">
        หน้านี้จะได้รับการอัปเดตก่อนเปิดให้บริการจริง เนื้อหาปัจจุบันยังไม่มีผลผูกพันใด ๆ
      </p>
    </InfoPage>
  );
}
