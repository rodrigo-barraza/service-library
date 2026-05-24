// ─────────────────────────────────────────────────────────────
// RequestLoggerMiddleware
// ─────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";
import { formatFileSize } from "@rodrigo-barraza/utilities-library";

const formatBytes = (bytes: number) => formatFileSize(bytes, { compact: true });

interface ReqLoggerLike {
  request?(...args: unknown[]): void;
  info?(message: string): void;
}

export interface RequestLoggerOptions {
  skipSSE?: boolean;
  skipAudio?: boolean;
  identityAware?: boolean;
}

export function createRequestLoggerMiddleware(logger: ReqLoggerLike, options: RequestLoggerOptions = {}) {
  const skipSSE = options.skipSSE !== false;
  const skipAudio = options.skipAudio !== false;
  const identityAware = options.identityAware !== false;

  return function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction) {
    const start = performance.now();

    res.on("finish", () => {
      const contentType = (res.getHeader("content-type") as string) || "";
      if (skipSSE && contentType.includes("text/event-stream")) return;
      if (skipAudio && contentType.includes("audio/")) return;

      const elapsed = performance.now() - start;
      const method = req.method;
      const path = req.originalUrl || req.url;
      const status = res.statusCode;
      const time = elapsed >= 1000 ? `${(elapsed / 1000).toFixed(2)}s` : `${Math.round(elapsed)}ms`;

      const inB = parseInt((req.headers["content-length"] as string) || "0", 10);
      const outB = parseInt((res.getHeader("content-length") as string) || "0", 10);
      const sizeTag = `(in: ${formatBytes(inB)}, out: ${formatBytes(outB)}, total: ${formatBytes(inB + outB)})`;

      const typedRequest = req as Request & { project?: string; username?: string; clientIp?: string };

      if (identityAware && logger.request && logger.request.length >= 4) {
        const project = typedRequest.project || (req.headers["x-project"] as string) || null;
        const username = typedRequest.username || (req.headers["x-username"] as string) || null;
        const fwd = req.headers["x-forwarded-for"];
        const clientIp = typedRequest.clientIp || (typeof fwd === "string" ? fwd.split(",")[0]?.trim() : undefined) || req.ip;
        logger.request(project, username, clientIp, `${method} ${path} ${status} — ${time} ${sizeTag}`);
      } else if (logger.request) {
        logger.request(method, path, status, time, sizeTag);
      } else if (logger.info) {
        logger.info(`${status} ${method} ${path} — ${time} ${sizeTag}`);
      }
    });

    next();
  };
}
