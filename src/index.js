// ─────────────────────────────────────────────────────────────
// @rodrigo-barraza/service-library — Node.js service entry point
// ─────────────────────────────────────────────────────────────
// Service Chassis Pattern: shared Express microservice bootstrap.
// All exports require Node.js (express, mongodb, process signals).
// ─────────────────────────────────────────────────────────────

// createService — The core factory
export { createService } from "./createService.js";

// MongoManager — MongoDB connection, index creation, health
export {
  MongoManager,
  connectDB,
  getDB,
  getCollection,
  disconnectDB,
} from "./MongoManager.js";

// MinioManager — MinIO S3-compatible object storage
export { MinioManager } from "./MinioManager.js";

// AuthMiddleware — Configurable identity resolution
export {
  createAuthMiddleware,
  createSecretGuard,
} from "./AuthMiddleware.js";

// RequestLoggerMiddleware — Console request logger with identity
export { createRequestLoggerMiddleware } from "./RequestLoggerMiddleware.js";

// HealthAggregator — Unified /health endpoint
export { HealthAggregator } from "./HealthAggregator.js";

// GracefulShutdown — Signal handlers + cleanup registry
export {
  registerCleanup,
  runCleanupFunctions,
  installShutdownHandlers,
  cleanupCount,
} from "./GracefulShutdown.js";

// CronScheduler — Named interval-based job scheduling
export { CronScheduler } from "./CronScheduler.js";
