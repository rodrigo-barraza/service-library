// @ts-nocheck
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CronScheduler } from "../src/CronScheduler.js";

describe("CronScheduler", () => {
  let scheduler;
  const silentLogger = {
    info: vi.fn(),
    error: vi.fn(),
  };

  beforeEach(() => {
    scheduler = new CronScheduler(silentLogger);
  });

  afterEach(() => {
    scheduler.cancelAll();
    vi.restoreAllMocks();
  });

  it("tracks a scheduled job in health", () => {
    scheduler.schedule("test", 1000, async () => {});
    const health = scheduler.getHealth();
    expect(health.test).toBeDefined();
    expect(health.test.intervalMs).toBe(1000);
    expect(health.test.runCount).toBe(0);
  });

  it("cancels a specific job", () => {
    scheduler.schedule("test", 1000, async () => {});
    scheduler.cancel("test");
    const health = scheduler.getHealth();
    expect(health.test).toBeUndefined();
  });

  it("cancels all jobs", () => {
    scheduler.schedule("a", 1000, async () => {});
    scheduler.schedule("b", 1000, async () => {});
    scheduler.cancelAll();
    const health = scheduler.getHealth();
    expect(Object.keys(health)).toHaveLength(0);
  });

  it("reports health for scheduled jobs", () => {
    scheduler.schedule("cleanup", 60000, async () => {});
    const health = scheduler.getHealth();
    expect(health.cleanup).toBeDefined();
    expect(health.cleanup.intervalMs).toBe(60000);
    expect(health.cleanup.runCount).toBe(0);
    expect(health.cleanup.lastRun).toBeNull();
    expect(health.cleanup.lastError).toBeNull();
  });

  it("replaces a job with the same name", () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    scheduler.schedule("dup", 1000, fn1);
    scheduler.schedule("dup", 2000, fn2);
    const health = scheduler.getHealth();
    expect(health.dup.intervalMs).toBe(2000);
  });

  it("executes immediately when option is set", async () => {
    let ran = false;
    scheduler.schedule("imm", 60000, async () => { ran = true; }, { immediate: true });
    // Give the microtask a chance to flush
    await new Promise((r) => setTimeout(r, 10));
    expect(ran).toBe(true);
  });

  it("logs scheduled job with interval formatting", () => {
    scheduler.schedule("hourly", 3600000, async () => {});
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("1.0h"),
    );
  });

  it("logs scheduled job with minute formatting", () => {
    scheduler.schedule("minutely", 120000, async () => {});
    expect(silentLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("2m"),
    );
  });
});
