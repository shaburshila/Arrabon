import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  AuthGuardError,
  requireAdmin,
} from "../../lib/auth/guards";

interface AuthGuardMocks {
  getAuthSessionFromToken: (...args: unknown[]) => Promise<{
    expires_at: string;
    is_admin: boolean;
    session_id: string;
    wallet_address: string;
  } | null>;
  getByWallet: (...args: unknown[]) => Promise<{
    avatar_url: string | null;
    created_at: string;
    id: string;
    username: string | null;
    wallet: string;
  } | null>;
  readSessionCookie: (...args: unknown[]) => Promise<string | null>;
}

const mocks = (global as typeof globalThis & { __authGuardMocks: AuthGuardMocks }).__authGuardMocks;

beforeEach(() => {
  mocks.readSessionCookie = async () => "session-token";
  mocks.getAuthSessionFromToken = async () => ({
    expires_at: "2026-04-12T12:00:00.000Z",
    is_admin: false,
    session_id: "session-id-1",
    wallet_address: "0x0000000000000000000000000000000000000001",
  });
  mocks.getByWallet = async () => ({
    avatar_url: null,
    created_at: "2026-04-10T00:00:00.000Z",
    id: "user-id-1",
    username: null,
    wallet: "0x0000000000000000000000000000000000000001",
  });
});

describe("requireAdmin", () => {
  test("rejects authenticated non-admin users", async () => {
    await assert.rejects(
      () => requireAdmin(),
      (error: unknown) => {
        assert.ok(error instanceof AuthGuardError);
        assert.equal(error.status, 403);
        return true;
      },
    );
  });

  test("returns authenticated admin users", async () => {
    mocks.getAuthSessionFromToken = async () => ({
      expires_at: "2026-04-12T12:00:00.000Z",
      is_admin: true,
      session_id: "session-id-1",
      wallet_address: "0x0000000000000000000000000000000000000001",
    });

    const result = await requireAdmin();

    assert.equal(result.id, "user-id-1");
    assert.equal(result.is_admin, true);
  });
});
