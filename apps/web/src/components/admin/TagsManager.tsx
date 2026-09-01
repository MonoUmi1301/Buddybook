"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

export interface AdminTagRow {
  tag_id: number;
  name: string;
  category: "genre" | "mood" | "theme" | null;
}

const categoryLabel: Record<string, string> = { genre: "แนวเรื่อง", mood: "อารมณ์", theme: "ธีม" };

interface TagsManagerProps {
  initialTags: AdminTagRow[];
}

// GET/POST /admin/tags, PATCH/DELETE /admin/tags/:tag_id — ดู API_Endpoints.md ส่วนที่ 5
export function TagsManager({ initialTags }: TagsManagerProps) {
  const [tags, setTags] = useState<AdminTagRow[]>(initialTags);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addTag(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/v1/admin/tags", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const tag = (await res.json()) as AdminTagRow;
      setTags((ts) => [...ts, tag]);
      setNewName("");
    } else if (res.status === 409) {
      setError("มีแท็กชื่อนี้อยู่แล้ว");
    } else {
      setError("เพิ่มแท็กไม่สำเร็จ");
    }
    setSubmitting(false);
  }

  async function removeTag(id: number) {
    const res = await fetch(`/api/v1/admin/tags/${id}`, { method: "DELETE" });
    if (res.ok) setTags((ts) => ts.filter((t) => t.tag_id !== id));
  }

  return (
    <div>
      <form onSubmit={addTag} className="mb-2 flex items-end gap-3">
        <div className="max-w-xs flex-1">
          <Input
            label="เพิ่มแท็กใหม่"
            placeholder="ชื่อแท็ก"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
        </div>
        <Button type="submit" variant="primary" loading={submitting}>
          <Plus className="h-4 w-4" />
          เพิ่ม
        </Button>
      </form>
      {error && <p className="mb-3 text-xs text-red-500">{error}</p>}

      <ul className="divide-y divide-neutral-100 rounded-card border border-neutral-200">
        {tags.map((t) => (
          <li key={t.tag_id} className="flex items-center justify-between px-4 py-3">
            <div>
              <span className="text-sm font-medium text-neutral-900">{t.name}</span>
              {t.category && (
                <span className="ml-2 rounded-pill bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500">
                  {categoryLabel[t.category]}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => removeTag(t.tag_id)}
              aria-label="ลบแท็ก"
              className="text-neutral-300 hover:text-red-500"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
