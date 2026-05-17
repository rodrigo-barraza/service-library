// ─────────────────────────────────────────────────────────────
// HealthAggregator — Unified /health endpoint
// ─────────────────────────────────────────────────────────────
export class HealthAggregator {
    #serviceName;
    #port;
    #checks = [];
    #startTime = Date.now();
    constructor(serviceName, port) {
        this.#serviceName = serviceName;
        this.#port = port;
    }
    /**
     * Register a named health check.
     */
    register(name, checkFn) {
        this.#checks.push({ name, check: checkFn });
        return this;
    }
    /**
     * Run all checks and return aggregated health.
     */
    async getHealth() {
        const results = {};
        let overallStatus = "ok";
        for (const { name, check } of this.#checks) {
            try {
                results[name] = await check();
                if (results[name].status !== "ok") {
                    overallStatus = "degraded";
                }
            }
            catch (error) {
                results[name] = { status: "error", error: error.message };
                overallStatus = "degraded";
            }
        }
        return {
            status: overallStatus,
            service: this.#serviceName,
            port: this.#port,
            uptime: Math.round((Date.now() - this.#startTime) / 1000),
            checks: results,
        };
    }
    /**
     * Express route handler for /health.
     */
    handler() {
        return async (_req, res) => {
            const health = await this.getHealth();
            const statusCode = health.status === "ok" ? 200 : 503;
            res.status(statusCode).json(health);
        };
    }
}
//# sourceMappingURL=HealthAggregator.js.map