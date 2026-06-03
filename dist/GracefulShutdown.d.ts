type CleanupFunction = () => Promise<void> | void;
/**
 * Register a cleanup function to run during graceful shutdown.
 * Returns an unregister function.
 */
export declare function registerCleanup(cleanupFunction: CleanupFunction): () => void;
export interface LoggerLike {
    info?(message: string): void;
    warn?(message: string): void;
    error?(message: string): void;
    success?(message: string): void;
    log?(message: string): void;
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