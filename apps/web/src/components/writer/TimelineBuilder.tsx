"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, Pencil, X, Check, Clock, Filter, List, LineChart, MapPin } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";

export interface TimelineEventData {
  id: string;
  order: number;
  title: string;
  description: string;
  date: string;
  time: string;
  thread: string;
  color: string;
  intensity: number;
}

type Draft = Omit<TimelineEventData, "id"> & { id: string | null };

// เพิ่มภายหลัง (audit fix) — date เดิมเป็นช่องพิมพ์อิสระ ผู้ใช้ขอให้เปลี่ยนเป็นปฏิทินจริง (input
// type="date") ค่าที่เก็บเลยเป็น ISO string (เช่น "2026-03-12") เสมอ — ฟังก์ชันนี้แปลงเป็น
// รูปแบบวันที่ไทยอ่านง่ายตอนแสดงผล (ยังคง fallback แสดงค่าดิบถ้า parse ไม่ได้ กัน legacy data
// แบบข้อความอิสระที่กรอกไว้ก่อนเปลี่ยนมาเป็นปฏิทิน)
function formatEventDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

const THREAD_COLORS = [
  { name: "ส้ม", hex: "#FF8A73" },
  { name: "เขียวมิ้นต์", hex: "#4FBDA6" },
  { name: "เหลืองน้ำผึ้ง", hex: "#FFB648" },
  { name: "ม่วง", hex: "#9C8FE0" },
  { name: "ฟ้า", hex: "#5FA8D3" },
  { name: "ชมพู", hex: "#F28FA0" },
];

const UNASSIGNED_LANE = "ไม่ระบุเส้นเรื่อง";

function emptyDraft(nextOrder: number): Draft {
  return {
    id: null,
    order: nextOrder,
    title: "",
    description: "",
    date: "",
    time: "",
    thread: "",
    color: THREAD_COLORS[0].hex,
    intensity: 5,
  };
}

interface TimelineBuilderProps {
  novelId: string;
  initialEvents: TimelineEventData[];
}

function EventForm({
  draft,
  setDraft,
  editingId,
  threads,
  saving,
  error,
  onSave,
  onCancel,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  editingId: string | null;
  threads: string[];
  saving: boolean;
  error: string | null;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-5 rounded-card border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800">
          {editingId ? "แก้ไขเหตุการณ์" : "เหตุการณ์ใหม่"}
        </span>
        <button type="button" onClick={onCancel} className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">ชื่อเหตุการณ์</label>
          <input
            type="text"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            placeholder="เช่น พระเอกพบนางเอกครั้งแรก"
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">วันที่ (ถ้ามี)</label>
          <input
            type="date"
            value={draft.date}
            onChange={(e) => setDraft({ ...draft, date: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">เวลา (ถ้ามี)</label>
          <input
            type="time"
            value={draft.time}
            onChange={(e) => setDraft({ ...draft, time: e.target.value })}
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">เส้นเรื่อง / ตัวละคร</label>
          <input
            type="text"
            list="thread-options"
            value={draft.thread}
            onChange={(e) => setDraft({ ...draft, thread: e.target.value })}
            placeholder="เช่น สายพระเอก"
            className="w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
          <datalist id="thread-options">
            {threads.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">สี</label>
          <div className="flex gap-2 pt-1.5">
            {THREAD_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                onClick={() => setDraft({ ...draft, color: c.hex })}
                aria-label={c.name}
                className="h-7 w-7 rounded-full transition hover:scale-110"
                style={{
                  background: c.hex,
                  outline: draft.color === c.hex ? `2px solid ${c.hex}` : "none",
                  outlineOffset: "2px",
                }}
              />
            ))}
          </div>
        </div>

        <div className="sm:col-span-2">
          <div className="mb-1.5 flex items-center justify-between">
            <label className="block text-xs font-medium text-neutral-500">ความเข้มข้น / อารมณ์ของฉาก</label>
            <span className="text-xs font-semibold text-primary-500">{draft.intensity} / 10</span>
          </div>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={draft.intensity}
            onChange={(e) => setDraft({ ...draft, intensity: Number(e.target.value) })}
            className="w-full accent-primary-500"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-neutral-400">
            <span>เนิบนิ่ง</span>
            <span>เข้มข้นสุด</span>
          </div>
        </div>

        <div className="sm:col-span-2">
          <label className="mb-1.5 block text-xs font-medium text-neutral-500">รายละเอียด</label>
          <textarea
            value={draft.description}
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            placeholder="สิ่งที่เกิดขึ้นในฉากนี้..."
            rows={3}
            className="w-full resize-none rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none transition focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
          />
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      <div className="mt-4 flex gap-2">
        <Button type="button" variant="primary" onClick={onSave} loading={saving} disabled={!draft.title.trim()}>
          <Check className="h-4 w-4" /> บันทึก
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          ยกเลิก
        </Button>
      </div>
    </div>
  );
}

// สวิมเลนกราฟ — หนึ่งแถวนอนต่อหนึ่งเส้นเรื่อง/ตัวละคร แกนนอนร่วมกันทุกแถวตามลำดับเหตุการณ์
// (order) ส่วนความสูงของจุดในแต่ละแถวสะท้อนความเข้มข้นของฉากนั้น (1 = ต่ำสุด, 10 = สูงสุด)
function TimelineGraph({ events, onMarkerClick }: { events: TimelineEventData[]; onMarkerClick: (ev: TimelineEventData) => void }) {
  const laneKeyOf = (ev: TimelineEventData) => ev.thread || UNASSIGNED_LANE;
  const laneOrder = Array.from(new Set(events.map(laneKeyOf)));
  const laneColor = (lane: string) => events.find((e) => laneKeyOf(e) === lane)?.color || "#C4BCAF";

  const laneHeight = 108;
  const padX = 50;
  const topPad = 8;
  const height = laneOrder.length * laneHeight + topPad;
  const width = Math.max(640, events.length * 130);

  const orders = events.map((e) => e.order);
  const minO = Math.min(...orders);
  const maxO = Math.max(...orders);
  const span = maxO - minO;

  const points = events.map((ev) => {
    const xRatio = events.length <= 1 ? 0.5 : span === 0 ? 0.5 : (ev.order - minO) / span;
    const x = padX + xRatio * (width - padX * 2);
    const laneIndex = laneOrder.indexOf(laneKeyOf(ev));
    const laneTop = topPad + laneIndex * laneHeight;
    const laneFloor = laneTop + laneHeight - 26;
    const laneCeil = laneTop + 22;
    const clampedIntensity = Math.min(10, Math.max(1, ev.intensity || 5));
    const y = laneFloor - ((clampedIntensity - 1) / 9) * (laneFloor - laneCeil);
    return { ...ev, x, y, laneIndex };
  });

  const laneGroups = laneOrder.map((lane, idx) => points.filter((p) => p.laneIndex === idx).sort((a, b) => a.x - b.x));

  return (
    <div className="mb-5 rounded-card border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex">
        <div className="w-24 shrink-0 pr-3">
          {laneOrder.map((lane) => (
            <div key={lane} className="flex items-center" style={{ height: laneHeight }}>
              <span className="truncate text-xs font-semibold leading-snug" style={{ color: laneColor(lane) }} title={lane}>
                {lane}
              </span>
            </div>
          ))}
        </div>

        <div className="-mr-1 flex-1 overflow-x-auto">
          <div style={{ position: "relative", width, height }}>
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="absolute inset-0">
              {laneOrder.map((lane, i) => (
                <rect key={lane} x={0} y={topPad + i * laneHeight} width={width} height={laneHeight} fill={i % 2 === 0 ? "#FAFAF9" : "#FFFFFF"} />
              ))}
              {laneOrder.slice(1).map((lane, i) => (
                <line key={`div-${lane}`} x1={0} y1={topPad + (i + 1) * laneHeight} x2={width} y2={topPad + (i + 1) * laneHeight} stroke="#E5E5E5" strokeWidth={1} />
              ))}
              {laneGroups.map((group, i) =>
                group.length > 1 ? (
                  <path
                    key={`path-${laneOrder[i]}`}
                    d={group.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")}
                    fill="none"
                    stroke={laneColor(laneOrder[i])}
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.55}
                  />
                ) : null
              )}
            </svg>

            {points.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onMarkerClick(p)}
                title={`${p.title} · เข้มข้น ${p.intensity}/10`}
                className="absolute flex flex-col items-center transition hover:scale-110"
                style={{ left: p.x, top: p.y, transform: "translate(-50%, -100%)" }}
              >
                <MapPin className="h-5 w-5 drop-shadow" fill={p.color} color="#FFFFFF" strokeWidth={1.5} />
                <span className="mt-0.5 whitespace-nowrap text-[10px] font-medium text-neutral-500">
                  {formatEventDate(p.date) || `#${p.order}`}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-neutral-400">
        แกนตั้งในแต่ละแถว = ความเข้มข้นของฉาก · แกนนอน = ลำดับเหตุการณ์
      </p>
    </div>
  );
}

/** ไทม์ไลน์เหตุการณ์แบบเต็มรูปแบบ — วันที่/เวลา/เส้นเรื่อง/สี/ความเข้มข้น/รายละเอียด แก้ไขได้จริง
 *  พร้อมมุมมองรายการและกราฟสวิมเลน (พอร์ตมาจาก buddybook_demo/tool_timeline ปรับให้เข้ากับ
 *  ดีไซน์ระบบและผูก backend จริงแทน localStorage) ผูกกับ timeline_events จริงทุกฟิลด์ */
export function TimelineBuilder({ novelId, initialEvents }: TimelineBuilderProps) {
  const [events, setEvents] = useState<TimelineEventData[]>(initialEvents);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [view, setView] = useState<"list" | "graph">("list");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threads = Array.from(new Set(events.map((e) => e.thread).filter(Boolean)));

  const visibleEvents = useMemo(
    () =>
      [...events]
        .filter((e) => !activeThread || e.thread === activeThread)
        .sort((a, b) => a.order - b.order),
    [events, activeThread]
  );

  function openNewForm() {
    const nextOrder = events.length ? Math.max(...events.map((e) => e.order)) + 1 : 0;
    setDraft(emptyDraft(nextOrder));
    setEditingId(null);
    setError(null);
  }

  function openEditForm(ev: TimelineEventData) {
    setDraft({ ...ev });
    setEditingId(ev.id);
    setError(null);
  }

  function closeForm() {
    setDraft(null);
    setEditingId(null);
    setError(null);
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim()) {
      setError("กรุณากรอกชื่อเหตุการณ์");
      return;
    }
    setSaving(true);
    setError(null);

    const payload = {
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      event_order: draft.order,
      event_date_in_story: draft.date.trim() || undefined,
      event_time: draft.time.trim() || undefined,
      thread: draft.thread.trim() || undefined,
      color: draft.color || undefined,
      intensity: draft.intensity,
    };

    try {
      if (editingId) {
        const res = await fetch(`/api/v1/timeline-events/${editingId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
          return;
        }
        setEvents((evs) => evs.map((e) => (e.id === editingId ? { ...draft, id: editingId } : e)));
      } else {
        const res = await fetch(`/api/v1/novels/${novelId}/timeline-events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (!res.ok) {
          setError("เพิ่มเหตุการณ์ไม่สำเร็จ ลองใหม่อีกครั้ง");
          return;
        }
        setEvents((evs) => [...evs, { ...draft, id: json.event_id }]);
      }
      closeForm();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(id: string) {
    setEvents((evs) => evs.filter((e) => e.id !== id));
    setConfirmDeleteId(null);
    try {
      await fetch(`/api/v1/timeline-events/${id}`, { method: "DELETE" });
    } catch {
      // ลบไม่สำเร็จฝั่ง server — UI ลบไปแล้วในเครื่อง ผู้ใช้ต้อง refresh เพื่อ sync ใหม่
    }
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <Button type="button" variant="primary" onClick={openNewForm}>
          <Plus className="h-4 w-4" /> เหตุการณ์ใหม่
        </Button>

        <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
          <button
            type="button"
            onClick={() => setView("list")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "list" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            )}
          >
            <List className="h-3.5 w-3.5" /> รายการ
          </button>
          <button
            type="button"
            onClick={() => setView("graph")}
            className={cn(
              "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
              view === "graph" ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-500"
            )}
          >
            <LineChart className="h-3.5 w-3.5" /> กราฟ
          </button>
        </div>

        {threads.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-neutral-300" />
            <button
              type="button"
              onClick={() => setActiveThread(null)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-medium transition",
                activeThread === null ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-500"
              )}
            >
              ทั้งหมด
            </button>
            {threads.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setActiveThread(t === activeThread ? null : t)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition",
                  activeThread === t ? "bg-neutral-800 text-white" : "bg-neutral-100 text-neutral-500"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        )}
      </div>

      {draft && !editingId && (
        <EventForm draft={draft} setDraft={setDraft} editingId={editingId} threads={threads} saving={saving} error={error} onSave={saveDraft} onCancel={closeForm} />
      )}

      {visibleEvents.length === 0 && !draft && (
        <div className="rounded-card border-[1.5px] border-dashed border-neutral-200 py-16 text-center">
          <p className="mb-2 text-2xl">📖</p>
          <p className="mb-3 text-sm text-neutral-500">ยังไม่มีเหตุการณ์ในเส้นเวลานี้</p>
          <button type="button" onClick={openNewForm} className="text-sm font-semibold text-primary-500">
            เริ่มปักหมุดเหตุการณ์แรก →
          </button>
        </div>
      )}

      {visibleEvents.length > 0 && view === "graph" && <TimelineGraph events={visibleEvents} onMarkerClick={openEditForm} />}

      {visibleEvents.length > 0 && view === "list" && (
        <div className="relative pl-7 sm:pl-9">
          <div className="absolute bottom-1 left-3 top-1 w-0.5 rounded-full bg-neutral-200 sm:left-4" />
          <div className="flex flex-col gap-3.5">
            {visibleEvents.map((ev) =>
              editingId === ev.id ? (
                <div key={ev.id} className="-ml-7 sm:-ml-9">
                  <EventForm draft={draft as Draft} setDraft={setDraft} editingId={editingId} threads={threads} saving={saving} error={error} onSave={saveDraft} onCancel={closeForm} />
                </div>
              ) : (
                <div key={ev.id} className="group relative">
                  <span
                    className="absolute -left-7 top-4 h-3.5 w-3.5 rounded-full border-[3px] border-white sm:-left-9"
                    style={{ background: ev.color || "#C4BCAF" }}
                  />
                  <div className="rounded-card border border-neutral-200 bg-white p-4 transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-400">
                          {ev.date && <span className="font-medium">{formatEventDate(ev.date)}</span>}
                          {ev.time && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {ev.time}
                            </span>
                          )}
                          {ev.thread && (
                            <span
                              className="rounded-full px-2 py-0.5 font-medium"
                              style={{ background: `${ev.color || "#C4BCAF"}1A`, color: ev.color || "#8A8479" }}
                            >
                              {ev.thread}
                            </span>
                          )}
                          <span className="text-neutral-300">เข้มข้น {ev.intensity}/10</span>
                        </div>
                        <h3 className="mb-1 truncate text-base font-semibold text-neutral-900">{ev.title}</h3>
                        {ev.description && <p className="text-sm leading-relaxed text-neutral-500">{ev.description}</p>}
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => openEditForm(ev)}
                          className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
                          aria-label="แก้ไขเหตุการณ์"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        {confirmDeleteId === ev.id ? (
                          <>
                            <button
                              type="button"
                              onClick={() => deleteEvent(ev.id)}
                              className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-semibold text-white"
                            >
                              ลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="rounded-full px-2 py-1 text-xs text-neutral-400"
                            >
                              ยกเลิก
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(ev.id)}
                            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100"
                            aria-label="ลบเหตุการณ์"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
