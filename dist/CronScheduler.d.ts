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
    schedule(name: string, intervalMs: number, fn: () => Promise<void> | void, options?: ScheduleOptions): this;
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
    getHealth(): Record<string, unknown>;
}
//# sourceMappingURL=CronScheduler.d.ts.map