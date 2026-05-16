// ─────────────────────────────────────────────────────────────
// @rodrigo-barraza/service-library — Node.js service entry point
// ─────────────────────────────────────────────────────────────

export { createService } from "./createService.ts";
export type { ServiceConfig, ServiceContext, RouteMount, CronJobConfig } from "./createService.ts";

export { MongoManager, connectDB, getDB, getCollection, disconnectDB, setDBForTesting, createIndexes } from "./MongoManager.ts";
export type { ConnectDBOptions, IndexSpec } from "./MongoManager.ts";

export { MinioManager } from "./MinioManager.ts";
export type { MinioInitConfig, MinioObjectInfo } from "./MinioManager.ts";

export { createAuthMiddleware, createSecretGuard } from "./AuthMiddleware.ts";
export type { AuthMiddlewareOptions, SecretGuardOptions } from "./AuthMiddleware.ts";

export { createRequestLoggerMiddleware } from "./RequestLoggerMiddleware.ts";
export type { RequestLoggerOptions } from "./RequestLoggerMiddleware.ts";

export { HealthAggregator } from "./HealthAggregator.ts";

export { registerCleanup, runCleanupFunctions, installShutdownHandlers, cleanupCount } from "./GracefulShutdown.ts";
export type { LoggerLike, ShutdownOptions } from "./GracefulShutdown.ts";

export { CronScheduler } from "./CronScheduler.ts";
export type { ScheduleOptions } from "./CronScheduler.ts";
