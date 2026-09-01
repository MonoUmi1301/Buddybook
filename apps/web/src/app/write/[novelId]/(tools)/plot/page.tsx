import { notFound } from "next/navigation";
import { NotesForm, type NotesFieldConfig } from "@/components/writer/NotesForm";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

const fields: NotesFieldConfig[] = [
  { name: "intro", label: "บทนำ", hint: "เช่น การบรรยายภาพสภาพแวดล้อมของเรื่องที่น่าสนใจ" },
  { name: "twist", label: "เหตุการณ์พลิกผัน", hint: "เช่น เรื่องราวที่พัฒนาไปในทิศทางที่ไม่คาดคิดอย่างกะทันหัน" },
  {
    name: "elements",
    label: "องค์ประกอบในเรื่อง",
    hint: "รูปแบบเรื่องราว เช่น ความสัมพันธ์ระหว่างตัวละครพัฒนาขึ้น พร้อมๆ กับที่เรื่องราวหลักดำเนินต่อไป",
  },
  {
    name: "realization",
    label: "การตระหนักรู้ การตัดสินใจ",
    hint: "เช่น ตัวเอกหลักได้รับเบาะแสใหม่และโอกาสในการไขคดี",
  },
  { name: "resolution", label: "เริ่มแก้ไขปัญหา", hint: "เช่น ทุกอย่างเริ่มดำเนินไปสู่บทสรุป" },
  { name: "ending", label: "ตอนจบ", hint: "บทสรุปของเรื่อง" },
];

interface WorldBuildingResponse {
  plot_notes?: Record<string, string>;
}

// แท็บ Plot — ดู wf_settings_forms.png (6 ช่อง textarea) ต่อกับ PATCH /novels/:id/plot-notes จริง
export default async function PlotPage({ params }: { params: { novelId: string } }) {
  const result = await callApi({
    method: "GET",
    path: `/novels/${params.novelId}/world-building`,
    token: getAccessToken(),
  });

  if ("error" in result || result.status === 403 || result.status === 404) notFound();
  if (result.status !== 200) {
    return <p className="text-sm text-red-500">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้ใหม่</p>;
  }

  const data = result.json as WorldBuildingResponse;

  return (
    <NotesForm
      novelId={params.novelId}
      endpoint="plot-notes"
      fields={fields}
      initialValues={data.plot_notes ?? {}}
      noteTitle="โน้ตโครงเรื่อง"
    />
  );
}
