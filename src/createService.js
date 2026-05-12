// ─────────────────────────────────────────────────────────────
// createService — Service Chassis factory
// ─────────────────────────────────────────────────────────────
// Wires Express + CORS + body parsing + auth + request logging +
// health + graceful shutdown in one call.
//
// Usage:
//   import { createService } from "@rodrigo-barraza/service-library";
//
//   const { app, db } = await createService({
//     name: "gauge-service",
//     port: 5595,
//     mongo: { uri: "mongodb://...", dbName: "gauge" },
//     routes: [
//       { path: "/sensors", router: sensorRoutes },
//       { path: "/readings", router: readingRoutes },
//     ],
//   });
// ─────────────────────────────────────────────────────────────

import express from "express";
import { createLogger } from "@rodrigo-barraza/utilities-library/node";

import { connectDB, disconnectDB } from "./MongoManager.js";
import { MinioManager } from "./MinioManager.js";
import {
  createAuthMiddleware,
  createSecretGuard,
} from "./AuthMiddleware.js";
import { createRequestLoggerMiddleware } from "./RequestLoggerMiddleware.js";
import { HealthAggregator } from "./HealthAggregator.js";
import {
  registerCleanup,
  installShutdownHandlers,
} from "./GracefulShutdown.js";
import { CronScheduler } from "./CronScheduler.js";
import { MongoManager } from "./MongoManager.js";

/**
 * @typedef {Object} ServiceConfig
 * @property {string} name - Service name (e.g. "gauge-service")
 * @property {number} port - Port to listen on
 * @property {string} [version="0.1.0"] - Service version
 * @property {string} [description] - Service description
 * @property {object} [mongo] - MongoDB configuration
 * @property {string} mongo.uri - Connection string
 * @property {string} [mongo.dbName] - Database name
 * @property {Array<{ collection: string, indexes: Array<{ key: object, options?: object }> }>} [mongo.indexes] - Index specs
 * @property {object} [minio] - MinIO configuration
 * @property {string} minio.endpoint - MinIO endpoint URL
 * @property {string} minio.accessKey
 * @property {string} minio.secretKey
 * @property {string} minio.bucket
 * @property {boolean} [minio.publicRead=false]
 * @property {object} [auth] - Auth configuration
 * @property {string} [auth.apiSecret] - Required API secret
 * @property {string} [auth.secretHeader="x-api-secret"]
 * @property {string[]} [auth.bypassPaths=["/health"]]
 * @property {string} [auth.defaultProject="default"]
 * @property {string} [auth.defaultUsername="anonymous"]
 * @property {Array<{ path: string, router: import("express").Router }>} [routes] - Route mounts
 * @property {string|string[]} [cors="*"] - CORS origin(s). "*" reflects request origin (open), array = whitelist + localhost + LAN
 * @property {string} [bodyLimit="10mb"] - JSON body size limit
 * @property {object} [logger] - Logger instance (auto-created if omitted)
 * @property {Function} [beforeRoutes] - Callback to add middleware before routes: (app, ctx) => void
 * @property {Function} [afterRoutes] - Callback to add middleware after routes: (app, ctx) => void
 * @property {boolean} [listen=true] - Whether to start listening
 * @property {Array<{ name: string, intervalMs: number, fn: Function, immediate?: boolean }>} [cron] - Cron jobs
 */

/**
 * Create and boot a fully configured Express service.
 *
 * @param {ServiceConfig} config
 * @returns {Promise<{ app: import("express").Express, db?: import("mongodb").Db, logger: object, health: HealthAggregator, scheduler: CronScheduler }>}
 */
export async function createService(config) {
  const {
    name,
    port,
    version = "0.1.0",
    description,
    cors: corsOrigin = "*",
    bodyLimit = "10mb",
    listen = true,
  } = config;

  const logger = config.logger || createLogger(name);
  const app = express();
  const health = new HealthAggregator(name, port);
  const scheduler = new CronScheduler(logger);

  // ── CORS ─────────────────────────────────────────────────
  // RFC 1918 private-network IP pattern — allows any LAN client
  const PRIVATE_IP_RE =
    /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (corsOrigin === "*") {
      // Open mode — reflect the request origin (supports credentials
      // unlike a literal "*", while remaining effectively open)
      res.header("Access-Control-Allow-Origin", origin || "*");
    } else if (Array.isArray(corsOrigin)) {
      // Whitelist mode — allow listed origins + localhost + private IPs
      const allowed =
        !origin ||
        corsOrigin.includes(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        PRIVATE_IP_RE.test(origin);
      res.header("Access-Control-Allow-Origin", allowed ? origin : "");
    } else {
      // Single origin string — use as-is
      res.header("Access-Control-Allow-Origin", corsOrigin);
    }

    res.header("Access-Control-Allow-Credentials", "true");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-api-secret, x-admin-secret, x-project, x-username, x-workspace-id, x-workspace-root, x-agent",
    );
    res.header(
      "Access-Control-Allow-Methods",
      "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    );
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  // ── Body parsing ─────────────────────────────────────────
  app.use(express.json({ limit: bodyLimit }));

  // ── Auth ─────────────────────────────────────────────────
  if (config.auth?.apiSecret) {
    app.use(
      createSecretGuard(config.auth.apiSecret, {
        header: config.auth.secretHeader,
        bypassPaths: config.auth.bypassPaths,
      }),
    );
  }
  app.use(
    createAuthMiddleware({
      defaultProject: config.auth?.defaultProject,
      defaultUsername: config.auth?.defaultUsername,
    }),
  );

  // ── Request logger ───────────────────────────────────────
  app.use(createRequestLoggerMiddleware(logger));

  // ── MongoDB ──────────────────────────────────────────────
  let db = null;
  if (config.mongo) {
    db = await connectDB(config.mongo.uri, {
      dbName: config.mongo.dbName,
      logger,
    });

    // Create indexes
    if (config.mongo.indexes) {
      for (const { collection, indexes } of config.mongo.indexes) {
        await MongoManager.createIndexes(collection, indexes);
      }
    }

    health.register("mongodb", () => MongoManager.healthCheck());
    registerCleanup(() => disconnectDB());
  }

  // ── MinIO ────────────────────────────────────────────────
  if (config.minio) {
    await MinioManager.init({ ...config.minio, logger });
    health.register("minio", () => MinioManager.healthCheck());
  }

  // ── Pre-route hook ───────────────────────────────────────
  const ctx = { app, db, logger, health, scheduler };
  if (config.beforeRoutes) {
    await config.beforeRoutes(app, ctx);
  }

  // ── Mount routes ─────────────────────────────────────────
  if (config.routes) {
    for (const { path, router } of config.routes) {
      app.use(path, router);
    }
  }

  // ── Post-route hook ──────────────────────────────────────
  if (config.afterRoutes) {
    await config.afterRoutes(app, ctx);
  }

  // ── Health endpoint ──────────────────────────────────────
  app.get("/health", health.handler());

  // ── Root endpoint ────────────────────────────────────────
  const routePaths = (config.routes || []).map((r) => r.path);
  app.get("/", (_req, res) => {
    res.json({
      service: name,
      version,
      description: description || `${name} API`,
      endpoints: Object.fromEntries(
        routePaths.map((p) => [p.replace(/^\//, ""), p]),
      ),
    });
  });

  // ── Error handler ────────────────────────────────────────
  app.use((err, _req, res, _next) => {
    logger.error(err.message);
    res.status(err.status || 500).json({
      error: true,
      message: err.message || "Internal server error",
      statusCode: err.status || 500,
    });
  });

  // ── Cron jobs ────────────────────────────────────────────
  if (config.cron) {
    for (const job of config.cron) {
      scheduler.schedule(job.name, job.intervalMs, job.fn, {
        immediate: job.immediate,
      });
    }
    registerCleanup(async () => scheduler.cancelAll());
    health.register("cron", async () => ({
      status: "ok",
      jobs: scheduler.getHealth(),
    }));
  }

  // ── Graceful shutdown ────────────────────────────────────
  installShutdownHandlers({ logger });

  // ── Listen ───────────────────────────────────────────────
  if (listen) {
    app.listen(port, () => {
      logger.success(`${name} running on port ${port}`);
      if (routePaths.length) {
        logger.info(`Routes: ${routePaths.join(", ")}`);
      }
    });
  }

  return { app, db, logger, health, scheduler };
}
