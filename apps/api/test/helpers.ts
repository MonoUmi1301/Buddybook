import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { app } from "@/app";
import { prisma } from "@/lib/prisma";
import { signAccessToken } from "@/lib/jwt";

/**
 * ตัวช่วยร่วมของเทสต์ integration รุ่นหลัง (recommendations, soft delete, stats, support)
 * ยิง HTTP จริงเข้า app บนพอร์ตสุ่ม — ผู้ใช้ที่สร้างผ่าน createUser ถูกเก็บไว้ลบทิ้งตอน stop()
 */
export function createHarness(prefix: string) {
  const tag = crypto.randomBytes(4).toString("hex");
  let server: Server | undefined;
  let baseUrl = "";
  const userIds: string[] = [];

  return {
    tag,
    userIds,
    async start() {
      await new Promise<void>((resolve) => {
        server = app.listen(0, resolve);
      });
      baseUrl = `http://127.0.0.1:${(server!.address() as AddressInfo).port}`;
    },
    async createUser(name: string, extra: { role?: "user" | "admin"; age_verified?: boolean } = {}) {
      const user = await prisma.user.create({
        data: {
          username: `${prefix}_${name}_${tag}`,
          email: `${prefix}_${name}_${tag}@test.buddybook.local`,
          password_hash: "not-a-real-hash",
          role: extra.role ?? "user",
          age_verified: extra.age_verified ?? false,
        },
        select: { user_id: true },
      });
      userIds.push(user.user_id);
      return { id: user.user_id, token: signAccessToken({ user_id: user.user_id, role: extra.role ?? "user" }) };
    },
    async api(method: string, path: string, token?: string, body?: unknown, headers: Record<string, string> = {}) {
      const res = await fetch(`${baseUrl}/api/v1${path}`, {
        method,
        headers: {
          ...(body ? { "Content-Type": "application/json" } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = text;
      }
      return { status: res.status, json, headers: res.headers };
    },
    /** ลบข้อมูลทั้งหมดที่ผูกกับผู้ใช้ทดสอบ (นิยายของพวกเขา cascade ตอน/รีวิว/แท็กไปด้วย) */
    async stop() {
      const ids = userIds;
      await prisma.comment.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.review.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.trashBin.deleteMany({ where: { novel: { author_id: { in: ids } } } });
      await prisma.novel.deleteMany({ where: { author_id: { in: ids } } });
      await prisma.notification.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.walletTransaction.deleteMany({ where: { user_id: { in: ids } } });
      await prisma.user.deleteMany({ where: { user_id: { in: ids } } });
      await new Promise((resolve) => server?.close(resolve));
    },
  };
}
