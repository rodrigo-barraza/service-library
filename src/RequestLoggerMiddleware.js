// ─────────────────────────────────────────────────────────────
// RequestLoggerMiddleware — Console request logger with identity
// ─────────────────────────────────────────────────────────────
// Features:
//   - Project/username/IP identity tagging
//   - SSE/audio stream skip (those are logged by route handlers)
//   - Request + response size reporting
//   - Timing in ms or s
// ─────────────────────────────────────────────────────────────

import { formatFileSize } from "@rodrigo-barraza/utilities-library";

const formatBytes = (bytes) => formatFileSize(bytes, { compact: true });

/**
 * Create an identity-aware request logger middleware.
 *
 * @param {object} logger - Logger instance with a `.request()` method
 *   that accepts (project, username, ip, message) — or a standard logger
 *   with `.info()`.
 * @param {object} [options]
 * @param {boolean} [options.skipSSE=true] - Skip logging SSE streams
 * @param {boolean} [options.skipAudio=true] - Skip logging audio streams
 * @param {boolean} [options.identityAware=true] - Include project/username/IP
 * @returns {Function} Express middleware
 */
export function createRequestLoggerMiddleware(logger, options = {}) {
  const skipSSE = options.skipSSE !== false;
  const skipAudio = options.skipAudio !== false;
  const identityAware = options.identityAware !== false;

  return function requestLoggerMiddleware(req, res, next) {
    const start = performance.now();

    res.on("finish", () => {
      // Skip streaming responses that are logged in detail by handlers
      const contentType = res.getHeader("content-type") || "";
      if (skipSSE && contentType.includes("text/event-stream")) return;
      if (skipAudio && contentType.includes("audio/")) return;

      const elapsed = performance.now() - start;
      const method = req.method;
      const path = req.originalUrl || req.url;
      const status = res.statusCode;

      // Format timing
      const time =
        elapsed >= 1000
          ? `${(elapsed / 1000).toFixed(2)}s`
          : `${Math.round(elapsed)}ms`;

      // Request / response sizes (from headers — zero-cost)
      const inBytes = parseInt(
        req.headers["content-length"] || "0",
        10,
      );
      const outBytes = parseInt(
        res.getHeader("content-length") || "0",
        10,
      );
      const totalBytes = inBytes + outBytes;
      const sizeTag = `(in: ${formatBytes(inBytes)}, out: ${formatBytes(outBytes)}, total: ${formatBytes(totalBytes)})`;

      if (identityAware && logger.request?.length >= 4) {
        // Identity-aware logger (prism-style)
        const project = req.project || req.headers["x-project"] || null;
        const username =
          req.username || req.headers["x-username"] || null;
        const clientIp =
          req.clientIp ||
          req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
          req.ip;

        logger.request(
          project,
          username,
          clientIp,
          `${method} ${path} ${status} — ${time} ${sizeTag}`,
        );
      } else if (logger.request) {
        // Simple logger (utilities-library style)
        logger.request(method, path, status, time, sizeTag);
      } else {
        // Fallback to console
        logger.info(
          `${status} ${method} ${path} — ${time} ${sizeTag}`,
        );
      }
    });

    next();
  };
}
