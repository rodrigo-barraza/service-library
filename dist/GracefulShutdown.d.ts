type CleanupFn = () => Promise<void> | void;
/**
 * Register a cleanup function to run during graceful shutdown.
 * Returns an unregister function.
 */
export declare function registerCleanup(cleanupFn: CleanupFn): () => void;
export interface LoggerLike {
    info?(msg: string): void;
    warn?(msg: string): void;
    error?(msg: string): void;
    success?(msg: string): void;
    log?(msg: string): void;
}
/**
 * Run all registered cleanup functions in parallel.
 */
export declare function runCleanupFunctions(logger?: LoggerLike): Promise<void>;
export interface ShutdownOptions {
    logger?: LoggerLike;
    timeoutMs?: number;
}
/**
 * Install process signal handlers (SIGTERM, SIGINT).
 */
export declare function installShutdownHandlers(options?: ShutdownOptions): void;
/**
 * Current count of registered cleanup functions.
 */
export declare function cleanupCount(): number;
export {};
//# sourceMappingURL=GracefulShutdown.d.ts.map