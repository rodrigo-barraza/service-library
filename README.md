# @rodrigo-barraza/service-library

**Service Chassis Pattern** — shared Express microservice bootstrap for the service ecosystem.

Eliminates ~300 lines of duplicated boilerplate per service by extracting the common boot sequence (Express + CORS + body parsing + auth + request logging + MongoDB + MinIO + health + graceful shutdown + cron) into a single `createService()` factory.

## Quick Start

```ts
import { createService } from "@rodrigo-barraza/service-library";
import sensorRoutes from "./routes/SensorRoutes.js";
import readingRoutes from "./routes/ReadingRoutes.js";

const { app, db } = await createService({
  name: "gauge-service",
  port: 5595,
  mongo: {
    uri: "mongodb://localhost:27017/gauge",
    indexes: [
      {
        collection: "sensors",
        indexes: [{ key: { type: 1 } }, { key: { name: 1 }, options: { unique: true } }],
      },
    ],
  },
  routes: [
    { path: "/sensors", router: sensorRoutes },
    { path: "/readings", router: readingRoutes },
  ],
});
```

## What `createService()` Does

1. Creates Express app with `express.json()` + CORS
2. Mounts optional secret guard (`x-api-secret`)
3. Mounts identity resolution middleware (project, username, IP)
4. Mounts request logger middleware with timing + sizes
5. Connects MongoDB (optional) with index creation
6. Connects MinIO (optional) with bucket auto-creation
7. Calls `beforeRoutes` hook (optional)
8. Mounts user-provided routes
9. Calls `afterRoutes` hook (optional)
10. Adds `/health` endpoint (aggregated from all subsystems)
11. Adds `/` root endpoint with service info
12. Adds error handler middleware
13. Starts cron jobs (optional)
14. Installs graceful shutdown handlers (SIGTERM/SIGINT)
15. Starts listening on the configured port

## Modules

### `createService(config)`

The main factory. See [createService.ts](src/createService.ts) for full `ServiceConfig` typedef.

### `MongoManager`

```ts
import { MongoManager, connectDB, getDB, getCollection } from "@rodrigo-barraza/service-library";

const db = await connectDB("mongodb://localhost:27017/mydb");
const col = getCollection("users");
```

### `MinioManager`

```ts
import { MinioManager } from "@rodrigo-barraza/service-library";

await MinioManager.init({ endpoint: "http://nas:9000", accessKey: "...", secretKey: "...", bucket: "uploads" });
await MinioManager.upload("path/file.png", buffer, "image/png");
const url = MinioManager.getPublicUrl("path/file.png");
```

### `AuthMiddleware`

```ts
import { createAuthMiddleware, createSecretGuard } from "@rodrigo-barraza/service-library";

app.use(createSecretGuard("my-secret", { bypassPaths: ["/health"] }));
app.use(createAuthMiddleware({ defaultProject: "myapp" }));
```

### `HealthAggregator`

```ts
import { HealthAggregator } from "@rodrigo-barraza/service-library";

const health = new HealthAggregator("my-service", 3000);
health.register("redis", async () => ({ status: "ok" }));
app.get("/health", health.handler());
```

### `GracefulShutdown`

```ts
import { registerCleanup, installShutdownHandlers } from "@rodrigo-barraza/service-library";

registerCleanup(async () => { await db.close(); });
installShutdownHandlers({ logger });
```

### `CronScheduler`

```ts
import { CronScheduler } from "@rodrigo-barraza/service-library";

const scheduler = new CronScheduler(logger);
scheduler.schedule("cleanup", 3600000, cleanupFn, { immediate: true });
```

## Individual Imports

Each module can be imported directly:

```ts
import { MongoManager } from "@rodrigo-barraza/service-library/mongo";
import { MinioManager } from "@rodrigo-barraza/service-library/minio";
import { createAuthMiddleware } from "@rodrigo-barraza/service-library/auth";
import { HealthAggregator } from "@rodrigo-barraza/service-library/health";
import { registerCleanup } from "@rodrigo-barraza/service-library/shutdown";
import { CronScheduler } from "@rodrigo-barraza/service-library/cron";
```

## Before/After Hooks

For service-specific middleware that needs to run before or after routes:

```ts
await createService({
  name: "prism-service",
  port: 7777,
  beforeRoutes: (app, { db, logger }) => {
    // Custom middleware before routes
    app.use(myCustomMiddleware);
  },
  afterRoutes: (app, { db, logger }) => {
    // WebSocket setup, etc.
  },
  routes: [...],
});
```

## Scripts

```bash
npm run lint            # Run ESLint
npm run format          # Format with Prettier
npm run format:check    # Check formatting
npm test                # Run tests (Vitest)
npm run test:watch      # Run tests in watch mode
npm run prepublishOnly  # Run tests before publishing
```

