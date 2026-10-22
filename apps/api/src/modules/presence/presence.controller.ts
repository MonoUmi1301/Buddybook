import type { Request, Response } from "express";
import { z } from "zod";
import { clearPresence, recordHeartbeat } from "@/lib/presence";

const heartbeatBodySchema = z.object({ leaving: z.boolean().optional() }).default({});

/** POST /presence/heartbeat — หน้าอ่านตอนส่งทุก 1 นาทีตอนแท็บเปิดอยู่ (leaving: true = ออกจากหน้าแล้ว) */
export async function heartbeat(req: Request, res: Response) {
  const { leaving } = heartbeatBodySchema.parse(req.body ?? {});
  const user_id = req.user!.user_id;
  if (leaving) clearPresence(user_id);
  else recordHeartbeat(user_id);
  res.status(204).end();
}
