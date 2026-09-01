import { notFound } from "next/navigation";
import type { Edge } from "@xyflow/react";
import { CharacterGraph, type CharacterRecord } from "@/components/writer/CharacterGraph";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

interface WorldBuildingResponse {
  characters: CharacterRecord[];
  edges: Edge[];
}

// แท็บ Character — ผังความสัมพันธ์ตัวละครแบบลาก-วางจริงด้วย @xyflow/react ดู wf_map_dm.png
export default async function CharactersPage({ params }: { params: { novelId: string } }) {
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

  return <CharacterGraph novelId={params.novelId} initialCharacters={data.characters} initialEdges={data.edges} />;
}
