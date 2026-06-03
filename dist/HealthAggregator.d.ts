import type { Request, Response } from "express";
export interface HealthCheckResult {
    status: string;
    [key: string]: unknown;
}
export interface HealthReport {
    status: string;
    service: string;
    port: number;
    nodeVersion: string;
    pythonVersion?: string;
    uptime: number;
    checks: Record<string, HealthCheckResult>;
}
export declare class HealthAggregator {
    #private;
    constructor(serviceName: string, port: number);
    /**
     * Register a named health check.
     */
    register(name: string, checkFunction: () => Promise<HealthCheckResult>): this;
    /**
     * Run all checks and return aggregated health.
     */
    getHealth(): Promise<HealthReport>;
    /**
     * Express route handler for /health.
     */
    handler(): (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=HealthAggregator.d.ts.map