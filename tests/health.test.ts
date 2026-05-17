// @ts-nocheck
import { describe, it, expect, beforeEach } from "vitest";
import { HealthAggregator } from "../src/HealthAggregator.js";

describe("HealthAggregator", () => {
  let health;

  beforeEach(() => {
    health = new HealthAggregator("test-service", 3000);
  });

  it("returns ok status with no checks", async () => {
    const result = await health.getHealth();
    expect(result.status).toBe("ok");
    expect(result.service).toBe("test-service");
    expect(result.port).toBe(3000);
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });

  it("includes passing checks", async () => {
    health.register("db", async () => ({ status: "ok", dbName: "test" }));
    const result = await health.getHealth();
    expect(result.status).toBe("ok");
    expect(result.checks.db.status).toBe("ok");
    expect(result.checks.db.dbName).toBe("test");
  });

  it("returns degraded when a check fails", async () => {
    health.register("db", async () => ({ status: "ok" }));
    health.register("redis", async () => ({ status: "error", error: "connection refused" }));
    const result = await health.getHealth();
    expect(result.status).toBe("degraded");
  });

  it("catches thrown errors from checks", async () => {
    health.register("broken", async () => {
      throw new Error("boom");
    });
    const result = await health.getHealth();
    expect(result.status).toBe("degraded");
    expect(result.checks.broken.status).toBe("error");
    expect(result.checks.broken.error).toBe("boom");
  });

  it("handler returns 200 for ok, 503 for degraded", async () => {
    const handler = health.handler();

    // ok case
    let statusCode, json;
    const res = {
      status(c) { statusCode = c; return this; },
      json(d) { json = d; },
    };
    await handler({}, res);
    expect(statusCode).toBe(200);

    // degraded case
    health.register("fail", async () => ({ status: "error" }));
    await handler({}, res);
    expect(statusCode).toBe(503);
  });

  it("supports method chaining on register", () => {
    const result = health
      .register("a", async () => ({ status: "ok" }))
      .register("b", async () => ({ status: "ok" }));
    expect(result).toBe(health);
  });
});
