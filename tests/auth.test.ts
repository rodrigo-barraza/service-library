import { describe, it, expect, beforeEach } from "vitest";
import {
  createAuthMiddleware,
  createSecretGuard,
} from "../src/AuthMiddleware.js";

// ── Helpers ────────────────────────────────────────────────

function mockReq(overrides = {}) {
  return {
    method: "GET",
    query: {},
    body: {},
    headers: {},
    ip: "127.0.0.1",
    path: "/test",
    ...overrides,
  };
}

function mockRes() {
  const res = {
    _status: null,
    _json: null,
    status(code) {
      res._status = code;
      return res;
    },
    json(data) {
      res._json = data;
      return res;
    },
    sendStatus(code) {
      res._status = code;
      return res;
    },
  };
  return res;
}

// ── createAuthMiddleware ───────────────────────────────────

describe("createAuthMiddleware", () => {
  let middleware;

  beforeEach(() => {
    middleware = createAuthMiddleware();
  });

  it("resolves project from x-project header", () => {
    const req = mockReq({ headers: { "x-project": "lupos" } });
    middleware(req, mockRes(), () => {});
    expect(req.project).toBe("lupos");
  });

  it("resolves project from query param (highest priority)", () => {
    const req = mockReq({
      query: { project: "from-query" },
      headers: { "x-project": "from-header" },
    });
    middleware(req, mockRes(), () => {});
    expect(req.project).toBe("from-query");
  });

  it("falls back to default project", () => {
    const req = mockReq();
    middleware(req, mockRes(), () => {});
    expect(req.project).toBe("default");
  });

  it("uses custom default project", () => {
    middleware = createAuthMiddleware({ defaultProject: "myapp" });
    const req = mockReq();
    middleware(req, mockRes(), () => {});
    expect(req.project).toBe("myapp");
  });

  it("resolves username from header", () => {
    const req = mockReq({ headers: { "x-username": "rodrigo" } });
    middleware(req, mockRes(), () => {});
    expect(req.username).toBe("rodrigo");
  });

  it("normalizes IPv4-mapped IPv6", () => {
    const req = mockReq({ ip: "::ffff:192.168.1.1" });
    middleware(req, mockRes(), () => {});
    expect(req.clientIp).toBe("192.168.1.1");
  });

  it("resolves x-forwarded-for", () => {
    const req = mockReq({
      headers: { "x-forwarded-for": "10.0.0.1, 192.168.1.1" },
    });
    middleware(req, mockRes(), () => {});
    expect(req.clientIp).toBe("10.0.0.1");
  });

  it("calls next()", () => {
    const req = mockReq();
    let called = false;
    middleware(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});

// ── createSecretGuard ──────────────────────────────────────

describe("createSecretGuard", () => {
  it("allows requests with correct secret", () => {
    const guard = createSecretGuard("my-secret");
    const req = mockReq({
      headers: { "x-api-secret": "my-secret" },
    });
    let called = false;
    guard(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("rejects requests with wrong secret", () => {
    const guard = createSecretGuard("my-secret");
    const req = mockReq({
      headers: { "x-api-secret": "wrong" },
    });
    const res = mockRes();
    guard(req, res, () => {});
    expect(res._status).toBe(401);
  });

  it("bypasses /health by default", () => {
    const guard = createSecretGuard("my-secret");
    const req = mockReq({ path: "/health" });
    let called = false;
    guard(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("bypasses OPTIONS (preflight)", () => {
    const guard = createSecretGuard("my-secret");
    const req = mockReq({ method: "OPTIONS" });
    let called = false;
    guard(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("uses custom header name", () => {
    const guard = createSecretGuard("tok", {
      header: "authorization",
    });
    const req = mockReq({ headers: { authorization: "tok" } });
    let called = false;
    guard(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });

  it("allows all when secret is empty", () => {
    const guard = createSecretGuard("");
    const req = mockReq();
    let called = false;
    guard(req, mockRes(), () => {
      called = true;
    });
    expect(called).toBe(true);
  });
});
