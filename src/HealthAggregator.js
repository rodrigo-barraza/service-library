// ─────────────────────────────────────────────────────────────
// HealthAggregator — Unified /health endpoint
// ─────────────────────────────────────────────────────────────

class HealthAggregator {
  #serviceName;
  #port;
  #checks = [];
  #startTime = Date.now();

  /**
   * @param {string} serviceName
   * @param {number} port
   */
  constructor(serviceName, port) {
    this.#serviceName = serviceName;
    this.#port = port;
  }

  /**
   * Register a named health check.
   * @param {string} name
   * @param {() => Promise<{ status: string }>} checkFn
   * @returns {this}
   */
  register(name, checkFn) {
    this.#checks.push({ name, check: checkFn });
    return this;
  }

  /**
   * Run all checks and return aggregated health.
   * @returns {Promise<object>}
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
      } catch (err) {
        results[name] = { status: "error", error: err.message };
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
   * @returns {Function}
   */
  handler() {
    return async (_req, res) => {
      const health = await this.getHealth();
      const statusCode = health.status === "ok" ? 200 : 503;
      res.status(statusCode).json(health);
    };
  }
}

export { HealthAggregator };
