// ─────────────────────────────────────────────────────────────
// HealthAggregator — Unified /health endpoint
// ─────────────────────────────────────────────────────────────
import { execFileSync } from "child_process";
import { errorMessage } from "@rodrigo-barraza/utilities-library";
/**
 * Detect the installed Python version at startup.
 * Returns the version string (e.g. "3.12.4") or null if Python is unavailable.
 */
function detectPythonVersion() {
    try {
        const output = execFileSync("python3", ["--version"], {
            encoding: "utf-8",
            timeout: 3000,
        });
        // Output: "Python 3.12.4\n"
        return output.trim().replace("Python ", "");
    }
    catch {
        return null;
    }
}
export class HealthAggregator {
    #serviceName;
    #port;
    #checks = [];
    #startTime = Date.now();
    #pythonVersion;
    constructor(serviceName, port) {
        this.#serviceName = serviceName;
        this.#port = port;
        this.#pythonVersion = detectPythonVersion();
    }
    /**
     * Register a named health check.
     */
    register(name, checkFunction) {
        this.#checks.push({ name, check: checkFunction });
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
                results[name] = { status: "error", error: errorMessage(error) };
                overallStatus = "degraded";
            }
        }
        return {
            status: overallStatus,
            service: this.#serviceName,
            port: this.#port,
            nodeVersion: process.version,
            ...(this.#pythonVersion && { pythonVersion: this.#pythonVersion }),
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