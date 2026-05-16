// ─────────────────────────────────────────────────────────────
// HealthAggregator — Unified /health endpoint
// ─────────────────────────────────────────────────────────────

import type { Request, Response } from "express";

interface HealthCheck {
  name: string;
  check: () => Promise<{ status: string; [key: string]: unknown }>;
}

export class HealthAggregator {
  #serviceName: string;
  #port: number;
  #checks: HealthCheck[] = [];
  #startTime = Date.now();

  constructor(serviceName: string, port: number) {
    this.#serviceName = serviceName;
    this.#port = port;
  }

  /**
   * Register a named health check.
   */
  register(name: string, checkFn: () => Promise<{ status: string; [key: string]: unknown }>): this {
    this.#checks.push({ name, check: checkFn });
    return this;
  }

  /**
   * Run all checks and return aggregated health.
   */
  async getHealth(): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    let overallStatus = "ok";

    for (const { name, check } of this.#checks) {
      try {
        results[name] = await check();
        if ((results[name] as { status: string }).status !== "ok") {
          overallStatus = "degraded";
        }
      } catch (error) {
        results[name] = { status: "error", error: (error as Error).message };
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
  handler(): (req: Request, res: Response) => Promise<void> {
    return async (_req: Request, res: Response) => {
      const health = await this.getHealth();
      const statusCode = health.status === "ok" ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }
}
