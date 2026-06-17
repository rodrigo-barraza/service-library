// ─────────────────────────────────────────────────────────────
// createService — Service Chassis factory
// ─────────────────────────────────────────────────────────────

import express, { type Router, type Express } from "express";
import type { Db } from "mongodb";
import { createLogger, type Logger } from "@rodrigo-barraza/utilities-library/node";

import { connectDatabase, disconnectDatabase, MongoManager } from "./MongoManager.ts";
import { MinioManager, type MinioInitConfig } from "./MinioManager.ts";
import { createAuthMiddleware, createSecretGuard } from "./AuthMiddleware.ts";
import { createRequestLoggerMiddleware } from "./RequestLoggerMiddleware.ts";
import { HealthAggregator } from "./HealthAggregator.ts";
import { registerCleanup, installShutdownHandlers } from "./GracefulShutdown.ts";
import { CronScheduler } from "./CronScheduler.ts";
import type { IndexSpec } from "./MongoManager.ts";

export interface RouteMount {
  path: string;
  router: Router;
}

export interface CronJobConfig {
  name: string;
  intervalMs: number;
  fn: () => Promise<void> | void;
  immediate?: boolean;
}

export interface ServiceConfig {
  name: string;
  port: number;
  version?: string;
  description?: string;
  mongo?: {
    uri: string;
    dbName?: string;
    indexes?: Array<{ collection: string; indexes: IndexSpec[] }>;
  };
  minio?: Omit<MinioInitConfig, "logger">;
  auth?: {
    apiSecret?: string;
    secretHeader?: string;
    bypassPaths?: string[];
    defaultProject?: string;
    defaultUsername?: string;
  };
  routes?: RouteMount[];
  cors?: string | string[];
  bodyLimit?: string;
  logger?: Logger;
  beforeRoutes?: (app: Express, context: ServiceContext) => void | Promise<void>;
  afterRoutes?: (app: Express, context: ServiceContext) => void | Promise<void>;
  listen?: boolean;
  cron?: CronJobConfig[];
}

export interface ServiceContext {
  app: Express;
  db: Db | null;
  logger: Logger;
  health: HealthAggregator;
  scheduler: CronScheduler;
}

export async function createService(config: ServiceConfig): Promise<ServiceContext> {
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
  const PRIVATE_IP_RE =
    /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/;

  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (corsOrigin === "*") {
      res.header("Access-Control-Allow-Origin", origin || "*");
    } else if (Array.isArray(corsOrigin)) {
      const allowed =
        !origin ||
        corsOrigin.includes(origin) ||
        /^http:\/\/localhost(:\d+)?$/.test(origin) ||
        PRIVATE_IP_RE.test(origin);
      res.header("Access-Control-Allow-Origin", allowed ? origin : "");
    } else {
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
  let database: Db | null = null;
  if (config.mongo) {
    database = await connectDatabase(config.mongo.uri, {
      dbName: config.mongo.dbName,
      logger,
    });

    if (config.mongo.indexes) {
      for (const { collection, indexes } of config.mongo.indexes) {
        await MongoManager.createIndexes(collection, indexes);
      }
    }

    health.register("mongodb", () => MongoManager.healthCheck());
    registerCleanup(() => disconnectDatabase());
  }

  // ── MinIO ────────────────────────────────────────────────
  if (config.minio) {
    await MinioManager.init({ ...config.minio, logger });
    health.register("minio", () => MinioManager.healthCheck());
  }

  // ── Pre-route hook ───────────────────────────────────────
  const serviceContext: ServiceContext = { app, db: database, logger, health, scheduler };
  if (config.beforeRoutes) {
    await config.beforeRoutes(app, serviceContext);
  }

  // ── Mount routes ─────────────────────────────────────────
  if (config.routes) {
    for (const { path, router } of config.routes) {
      app.use(path, router);
    }
  }

  // ── Post-route hook ──────────────────────────────────────
  if (config.afterRoutes) {
    await config.afterRoutes(app, serviceContext);
  }

  // ── Health endpoint ──────────────────────────────────────
  app.get("/health", health.handler());

  // ── Root endpoint ────────────────────────────────────────
  const routePaths = (config.routes || []).map((route) => route.path);
  app.get("/", (_req, res) => {
    res.json({
      service: name,
      version,
      description: description || `${name} API`,
      endpoints: Object.fromEntries(
        routePaths.map((pathItem) => [pathItem.replace(/^\//, ""), pathItem]),
      ),
    });
  });

  // ── Error handler ────────────────────────────────────────
  app.use((error: Error & { status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    logger.error(error.message);
    res.status(error.status || 500).json({
      error: true,
      message: error.message || "Internal server error",
      statusCode: error.status || 500,
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

  return serviceContext;
}
