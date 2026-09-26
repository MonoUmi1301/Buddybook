import { afterEach, describe, expect, it, vi } from "vitest";
import { isSchedulerEnabled, startScheduler } from "@/lib/scheduler";

const silent = { log: vi.fn(), warn: vi.fn() };

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("scheduler", () => {
  it("is disabled by default under NODE_ENV=test", () => {
    expect(isSchedulerEnabled()).toBe(false);
  });

  it("runs jobs on start and on every interval", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue({ ok: true });
    const stop = startScheduler([{ name: "job", intervalMs: 1000, run, runOnStart: true }], silent);

    expect(run).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(4);

    stop();
    await vi.advanceTimersByTimeAsync(5000);
    expect(run).toHaveBeenCalledTimes(4);
  });

  it("skips a tick while the previous run is still in progress", async () => {
    vi.useFakeTimers();
    let release!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => (release = resolve)));
    const stop = startScheduler([{ name: "slow", intervalMs: 1000, run }], silent);

    await vi.advanceTimersByTimeAsync(3500);
    expect(run).toHaveBeenCalledTimes(1);

    release();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
    stop();
  });

  it("keeps running after a job throws", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue({});
    const stop = startScheduler([{ name: "flaky", intervalMs: 1000, run }], silent);

    await vi.advanceTimersByTimeAsync(2000);
    expect(run).toHaveBeenCalledTimes(2);
    expect(silent.warn).toHaveBeenCalledWith("[scheduler] flaky failed:", "boom");
    stop();
  });
});
