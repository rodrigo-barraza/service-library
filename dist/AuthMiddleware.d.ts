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
export declare function createAuthMiddleware(options?: AuthMiddlewareOptions): (req: Request, _res: Response, next: NextFunction) => void;
export interface SecretGuardOptions {
    header?: string;
    bypassPaths?: string[];
}
/**
 * Create a secret-guard middleware.
 * Rejects requests that don't include the correct secret in the specified header.
 */
export declare function createSecretGuard(secret: string, options?: SecretGuardOptions): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=AuthMiddleware.d.ts.map