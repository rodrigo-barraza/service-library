// ─────────────────────────────────────────────────────────────
// AuthMiddleware — Configurable identity resolution + secret guard
// ─────────────────────────────────────────────────────────────
/**
 * Create an identity-resolution middleware.
 * Resolves project, username, clientIp, workspaceId, and workspaceRoot
 * from request headers and attaches them to `req`.
 */
export function createAuthMiddleware(options = {}) {
    const defaultProject = options.defaultProject || "default";
    const defaultUsername = options.defaultUsername || "anonymous";
    return function authMiddleware(req, _res, next) {
        const r = req;
        // Project: query param → body → header → default
        r.project =
            req.query?.project ||
                req.body?.project ||
                req.headers["x-project"] ||
                defaultProject;
        // Client IP: x-forwarded-for → req.ip, normalize IPv4-mapped IPv6
        const forwarded = req.headers["x-forwarded-for"];
        const rawIp = (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : undefined) || req.ip;
        r.clientIp = rawIp?.replace(/^::ffff:/, "") || rawIp || "";
        // Username from header (never fall back to IP)
        r.username = req.headers["x-username"] || defaultUsername;
        // Optional workspace scoping
        r.workspaceId = req.headers["x-workspace-id"] || null;
        r.workspaceRoot = req.headers["x-workspace-root"] || null;
        // Agent identifier
        r.agent = req.headers["x-agent"] || null;
        next();
    };
}
/**
 * Create a secret-guard middleware.
 * Rejects requests that don't include the correct secret in the specified header.
 */
export function createSecretGuard(secret, options = {}) {
    const header = options.header || "x-api-secret";
    const bypassPaths = new Set(options.bypassPaths || ["/health"]);
    return function secretGuard(req, res, next) {
        if (bypassPaths.has(req.path))
            return next();
        if (req.method === "OPTIONS")
            return next();
        const provided = req.headers[header];
        if (!secret || provided === secret)
            return next();
        res.status(401).json({ error: "Unauthorized" });
    };
}
//# sourceMappingURL=AuthMiddleware.js.map