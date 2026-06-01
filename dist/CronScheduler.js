// ─────────────────────────────────────────────────────────────
// CronScheduler — Named interval-based job scheduling
// ─────────────────────────────────────────────────────────────
import { errorMessage } from "@rodrigo-barraza/utilities-library";
export class CronScheduler {
    #jobs = new Map();
    #logger;
    constructor(logger) {
        this.#logger = logger || console;
    }
    /**
     * Register and start a recurring job.
     */
    schedule(name, intervalMs, fn, options = {}) {
        if (this.#jobs.has(name)) {
            this.cancel(name);
        }
        const job = {
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
            }
            catch (error) {
                job.lastError = errorMessage(error);
                if (this.#logger.error) {
                    this.#logger.error(`[Cron] ${name} failed: ${errorMessage(error)}`);
                }
            }
        };
        job.timer = setInterval(execute, intervalMs);
        this.#jobs.set(name, job);
        if (this.#logger.info) {
            const interval = intervalMs >= 3600000
                ? `${(intervalMs / 3600000).toFixed(1)}h`
                : intervalMs >= 60000
                    ? `${(intervalMs / 60000).toFixed(0)}m`
                    : `${intervalMs}ms`;
            this.#logger.info(`[Cron] Scheduled "${name}" every ${interval}`);
        }
        if (options.immediate)
            execute();
        return this;
    }
    /**
     * Cancel a scheduled job.
     */
    cancel(name) {
        const job = this.#jobs.get(name);
        if (job?.timer) {
            clearInterval(job.timer);
            this.#jobs.delete(name);
        }
    }
    /**
     * Cancel all scheduled jobs.
     */
    cancelAll() {
        for (const [name] of this.#jobs) {
            this.cancel(name);
        }
    }
    /**
     * Get health status for all jobs.
     */
    getHealth() {
        const jobs = {};
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
//# sourceMappingURL=CronScheduler.js.map