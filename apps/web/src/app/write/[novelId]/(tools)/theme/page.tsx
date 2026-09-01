import { notFound } from "next/navigation";
import { NotesForm, type NotesFieldConfig } from "@/components/writer/NotesForm";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

const fields: NotesFieldConfig[] = [
  { name: "mainTheme", label: "วาระสำคัญของเรื่อง", hint: "วาระสำคัญของเรื่อง" },
  { name: "symbol", label: "สัญลักษณ์ประจำเรื่อง", hint: "สิ่งของที่เป็นสัญลักษณ์ของเรื่อง" },
  { name: "message", label: "สารที่ต้องการสื่อ", hint: "คุณต้องการสื่อไรกับผู้อ่าน?" },
];

interface WorldBuildingResponse {
  theme_notes?: Record<string, string>;
}

// แท็บ Theme — ดู wf_map_dm.png (3 ช่อง textarea) ต่อกับ PATCH /novels/:id/theme-notes จริง
export default async function ThemePage({ params }: { params: { novelId: string } }) {
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
      endpoint="theme-notes"
      fields={fields}
      initialValues={data.theme_notes ?? {}}
      noteTitle="โน้ตแก่นเรื่อง"
    />
  );
}
