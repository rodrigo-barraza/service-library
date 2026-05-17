import type { Request, Response, NextFunction } from "express";
interface ReqLoggerLike {
    request?(...args: unknown[]): void;
    info?(message: string): void;
}
export interface RequestLoggerOptions {
    skipSSE?: boolean;
    skipAudio?: boolean;
    identityAware?: boolean;
}
export declare function createRequestLoggerMiddleware(logger: ReqLoggerLike, options?: RequestLoggerOptions): (req: Request, res: Response, next: NextFunction) => void;
export {};
//# sourceMappingURL=RequestLoggerMiddleware.d.ts.map