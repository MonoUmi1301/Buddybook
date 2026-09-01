"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Button } from "@/components/ui/Button";
import { useCloudinaryUpload } from "@/lib/useCloudinaryUpload";
import { cn } from "@/lib/cn";

interface AccountSettingsFormProps {
  username: string;
  penName: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

// อวาต้ากราฟฟิกสำเร็จรูปของเว็บ (ลายอุ้งเท้าตามธีมมาสคอตของ BuddyBook) — ไฟล์อยู่ใน
// apps/web/public/avatars/ ให้เลือกได้เลยโดยไม่ต้องอัปโหลดรูปเอง
const PRESET_AVATARS = [
  "tan",
  "brown",
  "orange",
  "sky",
  "violet",
  "teal",
  "amber",
  "rose",
].map((name) => `/avatars/paw-${name}.svg`);

/** เพิ่มภายหลัง (audit fix) — หน้าตั้งค่าบัญชีเดิมไม่มีฟอร์มแก้ไขข้อมูลส่วนตัวเลย มีแค่โซนลบบัญชี
 *  ทั้งที่ PATCH /users/me รองรับอยู่แล้ว — เพิ่มฟอร์มนี้ให้แก้ username/นามปากกา/bio/รูปโปรไฟล์ได้จริง
 *  แยก username (ใช้กับคอมเมนต์/รีวิว) ออกจากนามปากกา (นักอ่านเห็นบนหน้านิยาย/ตอน) ตามที่ผู้ใช้ระบุ */
export function AccountSettingsForm({ username: initialUsername, penName: initialPenName, bio: initialBio, avatarUrl: initialAvatarUrl }: AccountSettingsFormProps) {
  const router = useRouter();
  const [username, setUsername] = useState(initialUsername);
  const [penName, setPenName] = useState(initialPenName ?? "");
  const [bio, setBio] = useState(initialBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const { upload, uploading, error: uploadError } = useCloudinaryUpload("avatars");

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file);
    if (url) {
      setAvatarUrl(url);
      setShowAvatarPicker(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      setError("กรุณากรอกชื่อผู้ใช้");
      return;
    }
    setSubmitting(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/v1/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          pen_name: penName.trim() || null,
          bio: bio.trim(),
          // avatar_url ของอวาต้าสำเร็จรูปเป็น path สัมพัทธ์ (/avatars/...) แต่ backend validate ด้วย
          // z.string().url() ซึ่งต้องการ URL แบบเต็มเสมอ — เติม origin ให้ก่อนส่งถ้ายังไม่ใช่ URL เต็ม
          avatar_url: avatarUrl ? new URL(avatarUrl, window.location.origin).toString() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setSaved(true);
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่อีกครั้ง");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-card border border-neutral-200 p-5">
      <div>
        <p className="mb-1.5 text-sm font-medium text-neutral-700">รูปโปรไฟล์</p>
        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl} alt={username} size="lg" />
          <div className="flex flex-col gap-2">
            <label className="inline-flex w-fit cursor-pointer items-center gap-1.5 rounded-pill border border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-600 hover:border-primary-400 hover:text-primary-500">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              อัปโหลดรูปของฉัน
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
            <button
              type="button"
              onClick={() => setShowAvatarPicker((v) => !v)}
              className="w-fit text-xs font-medium text-primary-500 hover:underline"
            >
              หรือเลือกอวาต้าน่ารักของเว็บ
            </button>
          </div>
        </div>
        {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}

        {showAvatarPicker && (
          <div className="mt-3 grid grid-cols-4 gap-2.5 sm:grid-cols-8">
            {PRESET_AVATARS.map((src) => (
              <button
                key={src}
                type="button"
                onClick={() => {
                  setAvatarUrl(src);
                  setShowAvatarPicker(false);
                }}
                className={cn(
                  "flex items-center justify-center rounded-full ring-2 ring-offset-2 transition-transform hover:scale-105",
                  avatarUrl === src ? "ring-primary-400" : "ring-transparent"
                )}
              >
                <Avatar src={src} alt="อวาต้า" size="lg" />
              </button>
            ))}
          </div>
        )}
      </div>

      <Input
        label="ชื่อผู้ใช้ (username)"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
        minLength={3}
        maxLength={50}
      />
      <p className="-mt-3 text-xs text-neutral-400">ใช้แสดงตอนคอมเมนต์และรีวิว ต้องไม่ซ้ำกับคนอื่น</p>

      <Input
        label="นามปากกา (ไม่บังคับ)"
        value={penName}
        onChange={(e) => setPenName(e.target.value)}
        maxLength={50}
        placeholder="เว้นว่างไว้ = ใช้ชื่อผู้ใช้แทน"
      />
      <p className="-mt-3 text-xs text-neutral-400">ชื่อที่นักอ่านเห็นบนหน้านิยายและหน้าตอนที่คุณเขียน</p>

      <Textarea label="เกี่ยวกับฉัน" value={bio} onChange={(e) => setBio(e.target.value)} rows={4} maxLength={2000} />

      {error && <p className="text-sm text-red-500">{error}</p>}
      {saved && !error && <p className="text-sm text-emerald-600">บันทึกข้อมูลแล้ว</p>}

      <div className="flex justify-end">
        <Button type="submit" variant="primary" loading={submitting}>
          บันทึกการเปลี่ยนแปลง
        </Button>
      </div>
    </form>
  );
}
