import type { LoggerLike } from "./GracefulShutdown.ts";
export interface ScheduleOptions {
    immediate?: boolean;
}
export declare class CronScheduler {
    #private;
    constructor(logger?: LoggerLike);
    /**
     * Register and start a recurring job.
     */
    schedule(name: string, intervalMs: number, taskFunction: () => Promise<void> | void, options?: ScheduleOptions): this;
    /**
     * Cancel a scheduled job.
     */
    cancel(name: string): void;
    /**
     * Cancel all scheduled jobs.
     */
    cancelAll(): void;
    /**
     * Get health status for all jobs.
     */
    getHealth(): Record<string, CronJobHealth>;
}
export interface CronJobHealth {
    intervalMs: number;
    lastRun: Date | null;
    lastError: string | null;
    runCount: number;
}
//# sourceMappingURL=CronScheduler.d.ts.map