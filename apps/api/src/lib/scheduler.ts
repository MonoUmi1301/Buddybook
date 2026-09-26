import { env } from "@/config/env";
import * as internalService from "@/modules/internal/internal.service";
import * as recommendationsService from "@/modules/recommendations/recommendations.service";

/**
 * เพิ่มภายหลัง (scheduler) — ตัวรันงานเบื้องหลังแบบ in-process แทน Cron Scheduler ภายนอก
 * เรียก service เดียวกับ endpoint /internal/* (ยังยิง endpoint เหล่านั้นจาก cron ภายนอกได้เหมือนเดิม)
 *
 * แต่ละงานมี guard กันรันซ้อน (ถ้ารอบก่อนยังไม่เสร็จจะข้ามรอบนี้) และ error ในงานหนึ่งไม่ทำให้ api ล่ม
 * ถ้ารัน api หลาย instance ให้เปิด scheduler แค่ instance เดียว (SCHEDULER_ENABLED=false ที่เหลือ) —
 * ทุกงาน idempotent อยู่แล้ว แต่จะเปลืองงานซ้ำ
 */

export interface ScheduledJob {
  name: string;
  intervalMs: number;
  run: () => Promise<unknown>;
  /** รันทันทีหนึ่งครั้งตอน start (ไม่ต้องรอครบ interval แรก) */
  runOnStart?: boolean;
}

export function defaultJobs(): ScheduledJob[] {
  return [
    {
      name: "publish-scheduled-chapters",
      intervalMs: env.SCHEDULE_PUBLISH_INTERVAL_SEC * 1000,
      run: internalService.publishScheduledChapters,
      runOnStart: true,
    },
    {
      name: "purge-expired-trash",
      intervalMs: env.SCHEDULE_TRASH_PURGE_INTERVAL_SEC * 1000,
      run: internalService.purgeExpiredTrash,
      runOnStart: true,
    },
    {
      name: "recommendations-full-resync",
      intervalMs: env.SCHEDULE_RECOMMENDATION_SYNC_INTERVAL_SEC * 1000,
      run: recommendationsService.fullResync,
    },
  ];
}

export function isSchedulerEnabled() {
  return env.SCHEDULER_ENABLED ?? env.NODE_ENV !== "test";
}

type Logger = Pick<Console, "log" | "warn">;

/** เริ่มทุกงาน — คืนฟังก์ชัน stop() สำหรับ graceful shutdown */
export function startScheduler(jobs: ScheduledJob[] = defaultJobs(), logger: Logger = console) {
  const timers: NodeJS.Timeout[] = [];
  const running = new Set<string>();

  const tick = async (job: ScheduledJob) => {
    if (running.has(job.name)) return;
    running.add(job.name);
    try {
      const result = await job.run();
      logger.log(`[scheduler] ${job.name}`, JSON.stringify(result ?? {}));
    } catch (err) {
      logger.warn(`[scheduler] ${job.name} failed:`, err instanceof Error ? err.message : err);
    } finally {
      running.delete(job.name);
    }
  };

  for (const job of jobs) {
    if (job.runOnStart) void tick(job);
    const t = setInterval(() => void tick(job), job.intervalMs);
    t.unref();
    timers.push(t);
  }

  return () => timers.forEach(clearInterval);
}
