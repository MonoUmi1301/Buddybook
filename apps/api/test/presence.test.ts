import { afterEach, describe, expect, it } from "vitest";
import { clearPresence, onlineReaderCount, ONLINE_WINDOW_MS, recordHeartbeat, resetPresence } from "@/lib/presence";

describe("presence (ผู้อ่านออนไลน์)", () => {
  afterEach(() => resetPresence());

  it("นับผู้ใช้ไม่ซ้ำที่ส่ง heartbeat ภายในหน้าต่างเวลา", () => {
    const t = 1_000_000;
    recordHeartbeat("a", t);
    recordHeartbeat("a", t + 60_000); // คนเดิมหลายแท็บ/หลายรอบ นับครั้งเดียว
    recordHeartbeat("b", t);
    expect(onlineReaderCount(t + 60_000)).toBe(2);
  });

  it("หมดเวลาแล้วไม่นับ", () => {
    recordHeartbeat("a", 0);
    recordHeartbeat("b", ONLINE_WINDOW_MS);
    expect(onlineReaderCount(ONLINE_WINDOW_MS + 1)).toBe(1);
  });

  it("leaving เอาออกทันที", () => {
    recordHeartbeat("a", 0);
    clearPresence("a");
    expect(onlineReaderCount(1)).toBe(0);
  });
});
