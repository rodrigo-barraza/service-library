// ─────────────────────────────────────────────────────────────
// AuthMiddleware — Configurable identity resolution + secret guard
// ─────────────────────────────────────────────────────────────
// Extracted from prism-service AuthMiddleware.
//
// Two composable middlewares:
//   1. createAuthMiddleware() — resolves project/username/IP from headers
//   2. createSecretGuard(secret) — rejects requests without a valid secret
// ─────────────────────────────────────────────────────────────

/**
 * Create an identity-resolution middleware.
 * Resolves project, username, clientIp, workspaceId, and workspaceRoot
 * from request headers and attaches them to `req`.
 *
 * @param {object} [options]
 * @param {string} [options.defaultProject="default"] - Fallback project name
 * @param {string} [options.defaultUsername="anonymous"] - Fallback username
 * @returns {Function} Express middleware
 */
export function createAuthMiddleware(options = {}) {
  const defaultProject = options.defaultProject || "default";
  const defaultUsername = options.defaultUsername || "anonymous";

  return function authMiddleware(req, _res, next) {
    // Project: query param → body → header → default
    req.project =
      req.query?.project ||
      req.body?.project ||
      req.headers["x-project"] ||
      defaultProject;

    // Client IP: x-forwarded-for → req.ip, normalize IPv4-mapped IPv6
    const rawIp =
      req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip;
    req.clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp;

    // Username from header (never fall back to IP)
    req.username = req.headers["x-username"] || defaultUsername;

    // Optional workspace scoping
    req.workspaceId = req.headers["x-workspace-id"] || null;
    req.workspaceRoot = req.headers["x-workspace-root"] || null;

    // Agent identifier
    req.agent = req.headers["x-agent"] || null;

    next();
  };
}

/**
 * Create a secret-guard middleware.
 * Rejects requests that don't include the correct secret in the specified header.
 *
 * @param {string} secret - Expected secret value
 * @param {object} [options]
 * @param {string} [options.header="x-api-secret"] - Header name to check
 * @param {string[]} [options.bypassPaths=[]] - Paths that skip auth (e.g. ["/health"])
 * @returns {Function} Express middleware
 */
export function createSecretGuard(secret, options = {}) {
  const header = options.header || "x-api-secret";
  const bypassPaths = new Set(options.bypassPaths || ["/health"]);

  return function secretGuard(req, res, next) {
    // Skip auth for bypassed paths
    if (bypassPaths.has(req.path)) return next();

    // Skip preflight
    if (req.method === "OPTIONS") return next();

    // Validate secret
    const provided = req.headers[header];
    if (!secret || provided === secret) return next();

    res.status(401).json({ error: "Unauthorized" });
  };
}
