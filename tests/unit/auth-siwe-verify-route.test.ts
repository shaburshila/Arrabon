import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../app/api/auth/siwe/verify/route";

interface AuthSiweVerifyMocks {
  countRecentSecurityRequestAttempts: (...args: unknown[]) => Promise<number>;
  createAuthSession: (...args: unknown[]) => Promise<{
    expiresAt: Date;
    token: string;
  }>;
  createSecurityRequestAttempt: (...args: unknown[]) => Promise<unknown>;
  consumeValidNonce: (...args: unknown[]) => Promise<{ id: string } | null>;
  deleteExpiredSecurityRequestAttempts: (...args: unknown[]) => Promise<void>;
  getOrCreateUser: (...args: unknown[]) => Promise<unknown>;
  isAdminWallet: (...args: unknown[]) => boolean;
  parseSiweMessage: (...args: unknown[]) => {
    address: string;
  };
  resolveAllowedAuthDomains: (...args: unknown[]) => string[];
  setSessionCookie: (...args: unknown[]) => void;
  verifySiweMessage: (...args: unknown[]) => Promise<{
    address: string;
    nonce: string;
  }>;
}

const mocks = (global as typeof globalThis & { __authSiweVerifyMocks: AuthSiweVerifyMocks })
  .__authSiweVerifyMocks;

beforeEach(() => {
  mocks.countRecentSecurityRequestAttempts = async () => 0;
  mocks.resolveAllowedAuthDomains = () => ["localhost"];
  mocks.parseSiweMessage = () => ({
    address: "0x0000000000000000000000000000000000000001",
  });
  mocks.verifySiweMessage = async () => ({
    address: "0x0000000000000000000000000000000000000001",
    nonce: "nonce-1",
  });
  mocks.deleteExpiredSecurityRequestAttempts = async () => {};
  mocks.createSecurityRequestAttempt = async () => ({
    id: "attempt-id-1",
  });
  mocks.consumeValidNonce = async () => ({
    id: "nonce-id-1",
  });
  mocks.getOrCreateUser = async () => ({
    id: "user-id-1",
  });
  mocks.createAuthSession = async () => ({
    expiresAt: new Date("2026-05-01T12:00:00.000Z"),
    token: "session-token",
  });
  mocks.isAdminWallet = () => false;
  mocks.setSessionCookie = () => {};
});

test("returns a fixed authentication error instead of leaking internal details", async () => {
  const thrownError = new Error("relation public.sessions does not exist");
  mocks.verifySiweMessage = async () => {
    throw thrownError;
  };

  const request = new Request("http://localhost/api/auth/siwe/verify", {
    body: JSON.stringify({
      message: "siwe-message",
      signature: "0xsig",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    const response = await POST(request);
    const body = (await response.json()) as { error: string; ok: boolean };

    assert.equal(response.status, 401);
    assert.deepEqual(body, {
      error: "Authentication failed.",
      ok: false,
    });
    assert.equal(consoleCalls.length, 1);
    assert.equal(consoleCalls[0]?.[0], "[siwe/verify]");
    assert.equal(consoleCalls[0]?.[1], thrownError);
  } finally {
    console.error = originalConsoleError;
  }
});

test("returns 429 and skips crypto verify when verify rate limit is exceeded", async () => {
  let verifyCalled = false;
  mocks.countRecentSecurityRequestAttempts = async () => 5;
  mocks.verifySiweMessage = async () => {
    verifyCalled = true;
    return {
      address: "0x0000000000000000000000000000000000000001",
      nonce: "nonce-1",
    };
  };

  const request = new Request("http://localhost/api/auth/siwe/verify", {
    body: JSON.stringify({
      message: "siwe-message",
      signature: "0xsig",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const response = await POST(request);
  const body = (await response.json()) as { error: string; ok: boolean };

  assert.equal(response.status, 429);
  assert.deepEqual(body, {
    error: "Too many verification attempts. Please try again later.",
    ok: false,
  });
  assert.equal(verifyCalled, false);
});

test("uses atomic nonce consume in the happy path", async () => {
  const consumeCalls: unknown[][] = [];
  mocks.consumeValidNonce = async (...args: unknown[]) => {
    consumeCalls.push(args);
    return {
      id: "nonce-id-1",
    };
  };

  const request = new Request("http://localhost/api/auth/siwe/verify", {
    body: JSON.stringify({
      message: "siwe-message",
      signature: "0xsig",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const response = await POST(request);
  const body = (await response.json()) as { ok: boolean; wallet_address: string };

  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.wallet_address, "0x0000000000000000000000000000000000000001");
  assert.equal(consumeCalls.length, 1);
  assert.equal(consumeCalls[0]?.[0], "0x0000000000000000000000000000000000000001");
  assert.equal(consumeCalls[0]?.[1], "nonce-1");
  assert.ok(consumeCalls[0]?.[2] instanceof Date);
});

test("returns 401 when atomic nonce consume returns null", async () => {
  mocks.consumeValidNonce = async () => null;

  const request = new Request("http://localhost/api/auth/siwe/verify", {
    body: JSON.stringify({
      message: "siwe-message",
      signature: "0xsig",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const response = await POST(request);
  const body = (await response.json()) as { error: string; ok: boolean };

  assert.equal(response.status, 401);
  assert.deepEqual(body, {
    error: "Nonce is invalid or expired.",
    ok: false,
  });
});

test("returns the same fixed authentication error for non-Error throws", async () => {
  const thrownValue = { code: 500, detail: "raw internal failure" };
  mocks.verifySiweMessage = async () => {
    throw thrownValue;
  };

  const request = new Request("http://localhost/api/auth/siwe/verify", {
    body: JSON.stringify({
      message: "siwe-message",
      signature: "0xsig",
    }),
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });

  const originalConsoleError = console.error;
  const consoleCalls: unknown[][] = [];
  console.error = (...args: unknown[]) => {
    consoleCalls.push(args);
  };

  try {
    const response = await POST(request);
    const body = (await response.json()) as { error: string; ok: boolean };

    assert.equal(response.status, 401);
    assert.deepEqual(body, {
      error: "Authentication failed.",
      ok: false,
    });
    assert.equal(consoleCalls.length, 1);
    assert.equal(consoleCalls[0]?.[0], "[siwe/verify]");
    assert.equal(consoleCalls[0]?.[1], thrownValue);
  } finally {
    console.error = originalConsoleError;
  }
});
