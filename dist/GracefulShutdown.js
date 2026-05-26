// ─────────────────────────────────────────────────────────────
// GracefulShutdown — Signal handlers + cleanup registry
// ─────────────────────────────────────────────────────────────
const cleanupFunctions = new Set();
let isRunning = false;
/**
 * Register a cleanup function to run during graceful shutdown.
 * Returns an unregister function.
 */
export function registerCleanup(cleanupFn) {
    cleanupFunctions.add(cleanupFn);
    return () => cleanupFunctions.delete(cleanupFn);
}
/**
 * Run all registered cleanup functions in parallel.
 */
export async function runCleanupFunctions(logger) {
    if (isRunning)
        return;
    isRunning = true;
    const log = logger || console;
    const count = cleanupFunctions.size;
    if (count === 0) {
        isRunning = false;
        return;
    }
    if (log.info)
        log.info(`Running ${count} cleanup function(s)…`);
    const results = await Promise.allSettled(Array.from(cleanupFunctions).map((cleanupFunction) => cleanupFunction()));
    let failures = 0;
    for (const result of results) {
        if (result.status === "rejected") {
            failures++;
            if (log.error)
                log.error(`Cleanup failed: ${result.reason?.message || result.reason}`);
        }
    }
    if (failures > 0 && log.warn) {
        log.warn(`${failures}/${count} cleanup function(s) failed`);
    }
    else if (log.success) {
        log.success(`All ${count} cleanup function(s) completed`);
    }
    isRunning = false;
}
/**
 * Install process signal handlers (SIGTERM, SIGINT).
 */
export function installShutdownHandlers(options = {}) {
    const logger = options.logger || console;
    const timeoutMs = options.timeoutMs || 5000;
    let shuttingDown = false;
    const handleShutdown = async (signal) => {
        if (shuttingDown)
            return;
        shuttingDown = true;
        if (logger.info)
            logger.info(`Received ${signal}, shutting down…`);
        const hardTimeout = setTimeout(() => {
            if (logger.error)
                logger.error(`Cleanup timed out after ${timeoutMs}ms, forcing exit`);
            process.exit(1);
        }, timeoutMs);
        hardTimeout.unref();
        try {
            await runCleanupFunctions(logger);
        }
        catch (error) {
            if (logger.error)
                logger.error(`Fatal cleanup error: ${error.message}`);
        }
        clearTimeout(hardTimeout);
        process.exit(0);
    };
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));
    process.on("SIGINT", () => handleShutdown("SIGINT"));
}
/**
 * Current count of registered cleanup functions.
 */
export function cleanupCount() {
    return cleanupFunctions.size;
}
//# sourceMappingURL=GracefulShutdown.js.map