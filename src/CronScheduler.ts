// ─────────────────────────────────────────────────────────────
// CronScheduler — Named interval-based job scheduling
// ─────────────────────────────────────────────────────────────

import type { LoggerLike } from "./GracefulShutdown.ts";
import { errorMessage } from "@rodrigo-barraza/utilities-library";

interface Job {
  name: string;
  intervalMs: number;
  fn: () => Promise<void> | void;
  timer: ReturnType<typeof setInterval> | null;
  lastRun: Date | null;
  lastError: string | null;
  runCount: number;
}

export interface ScheduleOptions {
  immediate?: boolean;
}

export class CronScheduler {
  #jobs = new Map<string, Job>();
  #logger: LoggerLike;

  constructor(logger?: LoggerLike) {
    this.#logger = logger || console;
  }

  /**
   * Register and start a recurring job.
   */
  schedule(name: string, intervalMs: number, fn: () => Promise<void> | void, options: ScheduleOptions = {}): this {
    if (this.#jobs.has(name)) {
      this.cancel(name);
    }

    const job: Job = {
      name,
      intervalMs,
      fn,
      timer: null,
      lastRun: null,
      lastError: null,
      runCount: 0,
    };

    const execute = async () => {
      try {
        await fn();
        job.lastRun = new Date();
        job.lastError = null;
        job.runCount++;
      } catch (error: unknown) {
        job.lastError = errorMessage(error);
        if (this.#logger.error) {
          this.#logger.error(`[Cron] ${name} failed: ${errorMessage(error)}`);
        }
      }
    };

    job.timer = setInterval(execute, intervalMs);
    this.#jobs.set(name, job);

    if (this.#logger.info) {
      const interval =
        intervalMs >= 3600000
          ? `${(intervalMs / 3600000).toFixed(1)}h`
          : intervalMs >= 60000
            ? `${(intervalMs / 60000).toFixed(0)}m`
            : `${intervalMs}ms`;
      this.#logger.info(`[Cron] Scheduled "${name}" every ${interval}`);
    }

    if (options.immediate) execute();

    return this;
  }

  /**
   * Cancel a scheduled job.
   */
  cancel(name: string): void {
    const job = this.#jobs.get(name);
    if (job?.timer) {
      clearInterval(job.timer);
      this.#jobs.delete(name);
    }
  }

  /**
   * Cancel all scheduled jobs.
   */
  cancelAll(): void {
    for (const [name] of this.#jobs) {
      this.cancel(name);
    }
  }

  /**
   * Get health status for all jobs.
   */
  getHealth(): Record<string, unknown> {
    const jobs: Record<string, unknown> = {};
    for (const [name, job] of this.#jobs) {
      jobs[name] = {
        intervalMs: job.intervalMs,
        lastRun: job.lastRun,
        lastError: job.lastError,
        runCount: job.runCount,
      };
    }
    return jobs;
  }
}
