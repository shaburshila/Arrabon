import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

function makeEntry(id: string, exports: unknown) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  } as const;
}

const root = path.resolve(__dirname, "../..");
const cookiesPath = path.resolve(root, "lib/auth/cookies.ts");
const sessionPath = path.resolve(root, "lib/auth/session.ts");

type RouteSession = {
  expires_at: string;
  is_admin: boolean;
  session_id: string;
  wallet_address: string;
};

const routeMocks = {
  clearSessionCookieCalls: 0,
  consoleErrors: [] as unknown[][],
  getAuthSessionFromCurrentCookieStrict: async (): Promise<RouteSession | null> => null,
  revokeAuthSession: async (_sessionId: string): Promise<unknown> => null,
  reset() {
    this.clearSessionCookieCalls = 0;
    this.consoleErrors = [];
    this.getAuthSessionFromCurrentCookieStrict = async () => null;
    this.revokeAuthSession = async () => null;
  },
};

(require.cache as Record<string, unknown>)[cookiesPath] = makeEntry(cookiesPath, {
  clearSessionCookie: (_response: unknown) => {
    routeMocks.clearSessionCookieCalls += 1;
  },
});

(require.cache as Record<string, unknown>)[sessionPath] = makeEntry(sessionPath, {
  getAuthSessionFromCurrentCookieStrict: () => routeMocks.getAuthSessionFromCurrentCookieStrict(),
  revokeAuthSession: (sessionId: string) => routeMocks.revokeAuthSession(sessionId),
});

const originalConsoleError = console.error;
console.error = (...args: unknown[]) => {
  routeMocks.consoleErrors.push(args);
};

const { POST } = require("../../app/api/auth/logout/route");

beforeEach(() => {
  routeMocks.reset();
});

describe("POST /api/auth/logout", () => {
  test("returns success and clears cookie when no session cookie is present", async () => {
    const response = await POST();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(routeMocks.clearSessionCookieCalls, 1);
  });

  test("returns success and clears cookie when cookie exists but no active session is found", async () => {
    routeMocks.getAuthSessionFromCurrentCookieStrict = async () => null;

    const response = await POST();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(routeMocks.clearSessionCookieCalls, 1);
  });

  test("returns 500 and does not clear cookie when strict lookup fails", async () => {
    routeMocks.getAuthSessionFromCurrentCookieStrict = async () => {
      throw new Error("db unavailable");
    };

    const response = await POST();

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: "LOGOUT_LOOKUP_FAILED",
      error: "Failed to invalidate the current session.",
    });
    assert.equal(routeMocks.clearSessionCookieCalls, 0);
    assert.equal(routeMocks.consoleErrors.length, 1);
  });

  test("returns success and clears cookie when revoke succeeds", async () => {
    routeMocks.getAuthSessionFromCurrentCookieStrict = async () => ({
      expires_at: "2026-05-05T12:00:00.000Z",
      is_admin: false,
      session_id: "session-id-1",
      wallet_address: "0x00000000000000000000000000000000000000AA",
    });
    let revokedSessionId: string | null = null;
    routeMocks.revokeAuthSession = async (sessionId: string) => {
      revokedSessionId = sessionId;
      return { id: sessionId };
    };

    const response = await POST();

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(revokedSessionId, "session-id-1");
    assert.equal(routeMocks.clearSessionCookieCalls, 1);
  });

  test("returns 500 and does not clear cookie when revoke fails", async () => {
    routeMocks.getAuthSessionFromCurrentCookieStrict = async () => ({
      expires_at: "2026-05-05T12:00:00.000Z",
      is_admin: false,
      session_id: "session-id-1",
      wallet_address: "0x00000000000000000000000000000000000000AA",
    });
    routeMocks.revokeAuthSession = async () => {
      throw new Error("revoke failed");
    };

    const response = await POST();

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), {
      code: "LOGOUT_REVOKE_FAILED",
      error: "Failed to invalidate the current session.",
    });
    assert.equal(routeMocks.clearSessionCookieCalls, 0);
    assert.equal(routeMocks.consoleErrors.length, 1);
  });
});

process.on("exit", () => {
  console.error = originalConsoleError;
});
