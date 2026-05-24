// ─────────────────────────────────────────────────────────────
// AuthMiddleware — Configurable identity resolution + secret guard
// ─────────────────────────────────────────────────────────────

import type { Request, Response, NextFunction } from "express";

export interface AuthMiddlewareOptions {
  defaultProject?: string;
  defaultUsername?: string;
}

/**
 * Create an identity-resolution middleware.
 * Resolves project, username, clientIp, workspaceId, and workspaceRoot
 * from request headers and attaches them to `req`.
 */
export function createAuthMiddleware(options: AuthMiddlewareOptions = {}) {
  const defaultProject = options.defaultProject || "default";
  const defaultUsername = options.defaultUsername || "anonymous";

  return function authMiddleware(req: Request, _res: Response, next: NextFunction) {
    const typedRequest = req as Request & {
      project: string;
      clientIp: string;
      username: string;
      workspaceId: string | null;
      workspaceRoot: string | null;
      agent: string | null;
    };

    // Project: query param → body → header → default
    typedRequest.project =
      (req.query?.project as string) ||
      req.body?.project ||
      (req.headers["x-project"] as string) ||
      defaultProject;

    // Client IP: x-forwarded-for → req.ip, normalize IPv4-mapped IPv6
    const forwarded = req.headers["x-forwarded-for"];
    const rawIp =
      (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) || req.ip;
    typedRequest.clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp || "";

    // Username from header (never fall back to IP)
    typedRequest.username = (req.headers["x-username"] as string) || defaultUsername;

    // Optional workspace scoping
    typedRequest.workspaceId = (req.headers["x-workspace-id"] as string) || null;
    typedRequest.workspaceRoot = (req.headers["x-workspace-root"] as string) || null;

    // Agent identifier
    typedRequest.agent = (req.headers["x-agent"] as string) || null;

    next();
  };
}

export interface SecretGuardOptions {
  header?: string;
  bypassPaths?: string[];
}

/**
 * Create a secret-guard middleware.
 * Rejects requests that don't include the correct secret in the specified header.
 */
export function createSecretGuard(secret: string, options: SecretGuardOptions = {}) {
  const header = options.header || "x-api-secret";
  const bypassPaths = new Set(options.bypassPaths || ["/health"]);

  return function secretGuard(req: Request, res: Response, next: NextFunction) {
    if (bypassPaths.has(req.path)) return next();
    if (req.method === "OPTIONS") return next();

    const provided = req.headers[header];
    if (!secret || provided === secret) return next();

    res.status(401).json({ error: "Unauthorized" });
  };
}
