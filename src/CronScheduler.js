// ─────────────────────────────────────────────────────────────
// CronScheduler — Named interval-based job scheduling
// ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Job
 * @property {string} name
 * @property {number} intervalMs
 * @property {Function} fn
 * @property {NodeJS.Timeout|null} timer
 * @property {Date|null} lastRun
 * @property {string|null} lastError
 * @property {number} runCount
 */

class CronScheduler {
  /** @type {Map<string, Job>} */
  #jobs = new Map();
  #logger;

  /**
   * @param {object} [logger] - Logger instance
   */
  constructor(logger) {
    this.#logger = logger || console;
  }

  /**
   * Register and start a recurring job.
   *
   * @param {string} name - Job name
   * @param {number} intervalMs - Interval in milliseconds
   * @param {Function} fn - Async function to execute
   * @param {object} [options]
   * @param {boolean} [options.immediate=false] - Run immediately
   * @returns {this}
   */
  schedule(name, intervalMs, fn, options = {}) {
    if (this.#jobs.has(name)) {
      this.cancel(name);
    }

    /** @type {Job} */
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
      } catch (error) {
        job.lastError = error.message;
        if (this.#logger.error) {
          this.#logger.error(`[Cron] ${name} failed: ${error.message}`);
        }
      }
    };

    job.timer = setInterval(execute, intervalMs);
    this.#jobs.set(name, job);

    if (this.#logger.info) {
      const interval =
        intervalMs >= 3600000
          ? `${(intervalMs / 3600000).toFixed(1)}h`
          : intervalMs >= 60000
            ? `${(intervalMs / 60000).toFixed(0)}m`
            : `${intervalMs}ms`;
      this.#logger.info(`[Cron] Scheduled "${name}" every ${interval}`);
    }

    if (options.immediate) execute();

    return this;
  }

  /**
   * Cancel a scheduled job.
   * @param {string} name
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
   * @returns {object}
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

export { CronScheduler };
