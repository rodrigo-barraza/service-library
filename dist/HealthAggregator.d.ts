import type { Request, Response } from "express";
export declare class HealthAggregator {
    #private;
    constructor(serviceName: string, port: number);
    /**
     * Register a named health check.
     */
    register(name: string, checkFn: () => Promise<{
        status: string;
        [key: string]: unknown;
    }>): this;
    /**
     * Run all checks and return aggregated health.
     */
    getHealth(): Promise<Record<string, unknown>>;
    /**
     * Express route handler for /health.
     */
    handler(): (req: Request, res: Response) => Promise<void>;
}
//# sourceMappingURL=HealthAggregator.d.ts.map