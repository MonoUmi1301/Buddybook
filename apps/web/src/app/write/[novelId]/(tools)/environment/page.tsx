import { notFound } from "next/navigation";
import { TimelineBuilder, type TimelineEventData } from "@/components/writer/TimelineBuilder";
import { callApi } from "@/lib/api/proxy";
import { getAccessToken } from "@/lib/api/auth";

interface WorldBuildingResponse {
  timeline_events: {
    event_id: string;
    title: string;
    description: string | null;
    event_order: number;
    event_date_in_story: string | null;
    event_time: string | null;
    thread: string | null;
    color: string | null;
    intensity: number | null;
  }[];
}

// แท็บ Environment — ไทม์ไลน์เหตุการณ์ ดู wf_map_dm.png
export default async function EnvironmentPage({ params }: { params: { novelId: string } }) {
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
  const events: TimelineEventData[] = data.timeline_events.map((e) => ({
    id: e.event_id,
    order: e.event_order,
    title: e.title,
    description: e.description ?? "",
    date: e.event_date_in_story ?? "",
    time: e.event_time ?? "",
    thread: e.thread ?? "",
    color: e.color ?? "",
    intensity: e.intensity ?? 5,
  }));

  return <TimelineBuilder novelId={params.novelId} initialEvents={events} />;
}
