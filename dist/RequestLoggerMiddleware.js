// ─────────────────────────────────────────────────────────────
// RequestLoggerMiddleware
// ─────────────────────────────────────────────────────────────
import { formatFileSize } from "@rodrigo-barraza/utilities-library";
const formatBytes = (bytes) => formatFileSize(bytes, { compact: true });
export function createRequestLoggerMiddleware(logger, options = {}) {
    const skipSSE = options.skipSSE !== false;
    const skipAudio = options.skipAudio !== false;
    const identityAware = options.identityAware !== false;
    return function requestLoggerMiddleware(req, res, next) {
        const start = performance.now();
        res.on("finish", () => {
            const contentType = res.getHeader("content-type") || "";
            if (skipSSE && contentType.includes("text/event-stream"))
                return;
            if (skipAudio && contentType.includes("audio/"))
                return;
            const elapsed = performance.now() - start;
            const method = req.method;
            const path = req.originalUrl || req.url;
            const status = res.statusCode;
            const time = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(2)}s` : `${Math.round(elapsed)}ms`;
            const inB = parseInt(req.headers["content-length"] || "0", 10);
            const outB = parseInt(res.getHeader("content-length") || "0", 10);
            const sizeTag = `(in: ${formatBytes(inB)}, out: ${formatBytes(outB)}, total: ${formatBytes(inB + outB)})`;
            const typedRequest = req;
            if (identityAware && logger.request && logger.request.length >= 4) {
                const project = typedRequest.project || req.headers["x-project"] || null;
                const username = typedRequest.username || req.headers["x-username"] || null;
                const fwd = req.headers["x-forwarded-for"];
                const clientIp = typedRequest.clientIp || (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined) || req.ip;
                logger.request(project, username, clientIp, `${method} ${path} ${status} — ${time} ${sizeTag}`);
            }
            else if (logger.request) {
                logger.request(method, path, status, time, sizeTag);
            }
            else if (logger.info) {
                logger.info(`${status} ${method} ${path} — ${time} ${sizeTag}`);
            }
        });
        next();
    };
}
//# sourceMappingURL=RequestLoggerMiddleware.js.map