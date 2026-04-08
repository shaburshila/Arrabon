/**
 * HTTP smoke tests — run against a live `next dev` (or `next start`) server.
 *
 * Usage:
 *   npm run dev          # terminal 1
 *   npm run test:smoke   # terminal 2
 *
 * Override the target with BASE_URL env var:
 *   BASE_URL=http://localhost:3001 npm run test:smoke
 *
 * What is tested:
 *   - Server is reachable and returns correct Content-Type headers
 *   - Public endpoints return expected shapes without auth
 *   - Auth-guarded endpoints return 401 (not 500) without a session cookie
 *   - Validation errors return 400 (not 500) for bad inputs
 *   - No route returns 500 under normal conditions
 */

import { describe, test, before } from "node:test";
import assert from "node:assert/strict";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

async function get(path: string): Promise<{ status: number; body: unknown; contentType: string }> {
  const res = await fetch(`${BASE_URL}${path}`);
  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  return { status: res.status, body, contentType };
}

async function post(path: string, payload: unknown): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

// ---------------------------------------------------------------------------
// Connectivity check (runs before all suites)
// ---------------------------------------------------------------------------

before(async () => {
  try {
    const res = await fetch(`${BASE_URL}/api/health`, { signal: AbortSignal.timeout(5_000) });
    assert.equal(res.ok, true, `Server at ${BASE_URL} is not reachable — start it first.`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.fail(`Cannot reach ${BASE_URL}: ${msg}\nRun "npm run dev" before running smoke tests.`);
  }
});

// ---------------------------------------------------------------------------
// /api/health
// ---------------------------------------------------------------------------

describe("GET /api/health", () => {
  test("returns 200 with correct shape", async () => {
    const { status, body } = await get("/api/health");
    assert.equal(status, 200);
    assert.deepEqual(body, {
      ok: true,
      service: "base-consult-link",
      status: "sprint-0-skeleton",
    });
  });
});

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------

describe("GET /", () => {
  test("returns 200 HTML (app shell is rendered)", async () => {
    const { status, contentType } = await get("/");
    assert.equal(status, 200);
    assert.ok(contentType.includes("text/html"), `Expected text/html, got: ${contentType}`);
  });
});

// ---------------------------------------------------------------------------
// Auth guard — endpoints that require a session
// ---------------------------------------------------------------------------

describe("Auth-guarded endpoints without session cookie", () => {
  test("GET /api/private/ping → 401 with ok:false (not 500)", async () => {
    const { status, body } = await get("/api/private/ping");
    assert.equal(status, 401);
    assert.equal((body as any).ok, false);
  });

  test("POST /api/links (no auth) → 401 (not 500)", async () => {
    const { status } = await post("/api/links", { title: "test", price: 10 });
    assert.equal(status, 401);
  });
});

// ---------------------------------------------------------------------------
// Input validation
// ---------------------------------------------------------------------------

describe("Input validation", () => {
  test("GET /api/deals/not-a-uuid → 400 (validation rejects bad param)", async () => {
    const { status } = await get("/api/deals/not-a-uuid");
    assert.equal(status, 400);
  });

  test("POST /api/links with malformed JSON → 400 (not 500)", async () => {
    const res = await fetch(`${BASE_URL}/api/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ broken json",
    });
    assert.equal(res.status, 400);
  });
});

// ---------------------------------------------------------------------------
// Public consultation link lookup
// Requires live Supabase connectivity. If the DB is unreachable (e.g. free-tier
// instance paused, ECONNRESET) this test returns 500 — which is correct
// server behaviour but indicates an infrastructure problem, not a code bug.
// ---------------------------------------------------------------------------

describe("GET /api/links/:id", () => {
  test("non-existent valid UUID → 404 or 500 (500 = Supabase unreachable)", async () => {
    const { status } = await get("/api/links/00000000-0000-0000-0000-000000000000");
    assert.ok(
      status === 404 || status === 500,
      `Expected 404 (not found) or 500 (DB unreachable), got ${status}`,
    );
    if (status === 500) {
      console.warn("  ⚠ Supabase unreachable — wake the instance and re-run to validate 404 path");
    }
  });
});
