// ─────────────────────────────────────────────────────────────
// HealthAggregator — Unified /health endpoint
// ─────────────────────────────────────────────────────────────

import { execFileSync } from "child_process";
import type { Request, Response } from "express";
import { errorMessage } from "@rodrigo-barraza/utilities-library";

export interface HealthCheckResult {
  status: string;
  [key: string]: unknown;
}

interface HealthCheck {
  name: string;
  check: () => Promise<HealthCheckResult>;
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

/**
 * Detect the installed Python version at startup.
 * Returns the version string (e.g. "3.12.4") or null if Python is unavailable.
 */
function detectPythonVersion(): string | null {
  try {
    const output = execFileSync("python3", ["--version"], {
      encoding: "utf-8",
      timeout: 3000,
    });
    // Output: "Python 3.12.4\n"
    return output.trim().replace("Python ", "");
  } catch {
    return null;
  }
}

export class HealthAggregator {
  #serviceName: string;
  #port: number;
  #checks: HealthCheck[] = [];
  #startTime = Date.now();
  #pythonVersion: string | null;

  constructor(serviceName: string, port: number) {
    this.#serviceName = serviceName;
    this.#port = port;
    this.#pythonVersion = detectPythonVersion();
  }

  /**
   * Register a named health check.
   */
  register(name: string, checkFunction: () => Promise<HealthCheckResult>): this {
    this.#checks.push({ name, check: checkFunction });
    return this;
  }

  /**
   * Run all checks and return aggregated health.
   */
  async getHealth(): Promise<HealthReport> {
    const results: Record<string, HealthCheckResult> = {};
    let overallStatus = "ok";

    for (const { name, check } of this.#checks) {
      try {
        results[name] = await check();
        if (results[name].status !== "ok") {
          overallStatus = "degraded";
        }
      } catch (error: unknown) {
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
  handler(): (req: Request, res: Response) => Promise<void> {
    return async (_req: Request, res: Response) => {
      const health = await this.getHealth();
      const statusCode = health.status === "ok" ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }
}
