import { notFound } from "next/navigation";
import type { Edge } from "@xyflow/react";
import { WorldMap, type LocationRecord, type MapDrawing } from "@/components/writer/WorldMap";
import type { LocationIconKey } from "@/components/writer/LocationNode";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

interface WorldBuildingResponse {
  locations: {
    location_id: string;
    name: string;
    map_icon_url: string | null;
    category: string | null;
    pos_x: number | null;
    pos_y: number | null;
    scale: number | null;
    rotation: number | null;
    flip_x: boolean | null;
    z_index: number | null;
    linked_chapter_id: string | null;
    description: string | null;
  }[];
  location_edges: Edge[];
  map_drawings: MapDrawing[];
}

interface ChapterListItem {
  chapter_id: string;
  chapter_number: number;
  title: string;
}

// แท็บ Base — แผนที่จักรวาลของเรื่อง ดู wf_map_dm.png
export default async function BasePage({ params }: { params: { novelId: string } }) {
  const token = getAccessToken();
  const [result, chaptersResult] = await Promise.all([
    callApi({ method: "GET", path: `/novels/${params.novelId}/world-building`, token }),
    callApi({ method: "GET", path: `/novels/${params.novelId}/chapters`, token }),
  ]);

  if ("error" in result || result.status === 403 || result.status === 404) notFound();
  if (result.status !== 200) {
    return <p className="text-sm text-red-500">โหลดข้อมูลไม่สำเร็จ ลองรีเฟรชหน้านี้ใหม่</p>;
  }

  const data = result.json as WorldBuildingResponse;
  const locations: LocationRecord[] = data.locations.map((l) => ({
    location_id: l.location_id,
    name: l.name,
    icon: (l.map_icon_url as LocationIconKey) || "castle",
    category: l.category ?? undefined,
    pos_x: l.pos_x,
    pos_y: l.pos_y,
    scale: l.scale ?? 1,
    rotation: l.rotation ?? 0,
    flip_x: l.flip_x ?? false,
    z_index: l.z_index ?? 0,
    linked_chapter_id: l.linked_chapter_id,
    description: l.description,
  }));

  const chapters: ChapterListItem[] =
    !("error" in chaptersResult) && chaptersResult.status === 200
      ? (chaptersResult.json as { chapters: ChapterListItem[] }).chapters.sort((a, b) => a.chapter_number - b.chapter_number)
      : [];

  return (
    <WorldMap
      novelId={params.novelId}
      initialLocations={locations}
      initialEdges={data.location_edges ?? []}
      initialDrawings={data.map_drawings ?? []}
      chapters={chapters}
    />
  );
}
