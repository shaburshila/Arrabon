import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  countRecentNonces,
  deleteExpiredNonces,
  invalidateActiveNonces,
} from "../../server/repositories/nonces";

interface AuthNoncesRepositoryMocks {
  calls: {
    delete: number;
    eq: unknown[];
    from: unknown[];
    gt: unknown[];
    gte: unknown[];
    is: unknown[];
    lte: unknown[];
    select: unknown[];
    update: unknown[];
  };
  countResult: {
    count: number | null;
    error: unknown;
  };
  deleteResult: {
    error: unknown;
  };
  reset: () => void;
  updateResult: {
    error: unknown;
  };
}

const mocks = (
  global as typeof globalThis & { __authNoncesRepositoryMocks: AuthNoncesRepositoryMocks }
).__authNoncesRepositoryMocks;

const WALLET = "0x0000000000000000000000000000000000000001";
const NOW = new Date("2026-04-23T10:00:00.000Z");
const SINCE = new Date("2026-04-23T09:50:00.000Z");

beforeEach(() => {
  mocks.reset();
});

describe("auth nonces repository hardening helpers", () => {
  test("counts all wallet nonces created after the cutoff", async () => {
    mocks.countResult = {
      count: 4,
      error: null,
    };

    const result = await countRecentNonces(WALLET, SINCE);

    assert.equal(result, 4);
    assert.deepEqual(mocks.calls.from, ["auth_nonces"]);
    assert.deepEqual(mocks.calls.select, [["id", { count: "exact", head: true }]]);
    assert.deepEqual(mocks.calls.eq, [["wallet", WALLET]]);
    assert.deepEqual(mocks.calls.gte, [["created_at", SINCE.toISOString()]]);
    assert.deepEqual(mocks.calls.is, []);
    assert.deepEqual(mocks.calls.gt, []);
  });

  test("throws when the count query fails or omits count", async () => {
    const dbError = { message: "db down" };
    mocks.countResult = {
      count: null,
      error: dbError,
    };

    await assert.rejects(
      () => countRecentNonces(WALLET, SINCE),
      /Failed to count recent auth nonces: db down/,
    );

    mocks.reset();
    mocks.countResult = {
      count: null,
      error: null,
    };

    await assert.rejects(
      () => countRecentNonces(WALLET, SINCE),
      /Failed to count recent auth nonces: count was not returned/,
    );
  });

  test("invalidates only active, unexpired nonces for the wallet", async () => {
    await invalidateActiveNonces(WALLET, NOW);

    assert.deepEqual(mocks.calls.from, ["auth_nonces"]);
    assert.deepEqual(mocks.calls.update, [{ used_at: NOW.toISOString() }]);
    assert.deepEqual(mocks.calls.eq, [["wallet", WALLET]]);
    assert.deepEqual(mocks.calls.is, [["used_at", null]]);
    assert.deepEqual(mocks.calls.gt, [["expires_at", NOW.toISOString()]]);
  });

  test("throws when active nonce invalidation fails", async () => {
    mocks.updateResult = {
      error: { message: "update failed" },
    };

    await assert.rejects(
      () => invalidateActiveNonces(WALLET, NOW),
      /Failed to invalidate active auth nonces: update failed/,
    );
  });

  test("deletes only expired nonces", async () => {
    await deleteExpiredNonces(NOW);

    assert.deepEqual(mocks.calls.from, ["auth_nonces"]);
    assert.equal(mocks.calls.delete, 1);
    assert.deepEqual(mocks.calls.lte, [["expires_at", NOW.toISOString()]]);
  });

  test("throws when expired nonce cleanup fails", async () => {
    mocks.deleteResult = {
      error: { message: "delete failed" },
    };

    await assert.rejects(
      () => deleteExpiredNonces(NOW),
      /Failed to delete expired auth nonces: delete failed/,
    );
  });
});
