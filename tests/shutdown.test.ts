// @ts-nocheck
import { describe, it, expect } from "vitest";
import {
  registerCleanup,
  runCleanupFunctions,
  cleanupCount,
} from "../src/GracefulShutdown.js";

describe("GracefulShutdown", () => {
  it("registers and runs cleanup functions", async () => {
    let called = false;
    const unregister = registerCleanup(async () => {
      called = true;
    });
    expect(cleanupCount()).toBeGreaterThanOrEqual(1);
    await runCleanupFunctions();
    expect(called).toBe(true);
    unregister();
  });

  it("returns unregister function", () => {
    const before = cleanupCount();
    const unregister = registerCleanup(async () => {});
    expect(cleanupCount()).toBe(before + 1);
    unregister();
    expect(cleanupCount()).toBe(before);
  });

  it("handles errors in cleanup without throwing", async () => {
    const unregister = registerCleanup(async () => {
      throw new Error("boom");
    });
    // Should not throw
    await runCleanupFunctions();
    unregister();
  });

  it("runs multiple cleanup functions in parallel", async () => {
    const order = [];
    const u1 = registerCleanup(async () => {
      order.push("a");
    });
    const u2 = registerCleanup(async () => {
      order.push("b");
    });
    await runCleanupFunctions();
    expect(order).toContain("a");
    expect(order).toContain("b");
    u1();
    u2();
  });
});
