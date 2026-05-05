import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  consumePayoutExecutionGrant,
  createPayoutExecutionGrant,
  PayoutExecutionGrantsRepositoryError,
} from "../../server/repositories/payout-execution-grants";

interface PayoutExecutionGrantsRepoMocks {
  calls: {
    eq: Array<[string, unknown]>;
    gt: Array<[string, unknown]>;
    in: Array<[string, unknown]>;
    insert: unknown[];
    is: Array<[string, unknown]>;
    schema: string[];
    update: unknown[];
  };
  maybeSingleResult: { data: unknown; error: unknown };
  reset: () => void;
  singleResult: { data: unknown; error: unknown };
}

const mocks = (
  global as typeof globalThis & {
    __payoutExecutionGrantsRepoMocks: PayoutExecutionGrantsRepoMocks;
  }
).__payoutExecutionGrantsRepoMocks;

beforeEach(() => {
  mocks.reset();
});

describe("payout-execution-grants repository", () => {
  test("createPayoutExecutionGrant inserts expected payload", async () => {
    const result = await createPayoutExecutionGrant({
      action: "confirmRelease",
      dealId: "deal-id-1",
      expiresAt: "2026-05-05T00:02:00.000Z",
      issuedByWallet: "0x0000000000000000000000000000000000000002",
      issuedToWallet: "0x0000000000000000000000000000000000000002",
      tokenHash: "hash-1",
    });

    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.insert, [{
      action: "confirmRelease",
      deal_id: "deal-id-1",
      expires_at: "2026-05-05T00:02:00.000Z",
      issued_by_wallet: "0x0000000000000000000000000000000000000002",
      issued_to_wallet: "0x0000000000000000000000000000000000000002",
      resolution: null,
      token_hash: "hash-1",
    }]);
    assert.equal((result as { id: string }).id, "grant-id-1");
  });

  test("consumePayoutExecutionGrant applies atomic consume filters", async () => {
    const result = await consumePayoutExecutionGrant({
      allowedActions: ["adminResolveRelease", "adminResolveRefund"],
      dealId: "deal-id-1",
      issuedToWallet: "0x0000000000000000000000000000000000000003",
      now: "2026-05-05T00:01:00.000Z",
      tokenHash: "hash-1",
    });

    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.update, [{ used_at: "2026-05-05T00:01:00.000Z" }]);
    assert.deepEqual(mocks.calls.eq, [
      ["token_hash", "hash-1"],
      ["deal_id", "deal-id-1"],
      ["issued_to_wallet", "0x0000000000000000000000000000000000000003"],
    ]);
    assert.deepEqual(mocks.calls.is, [["used_at", null]]);
    assert.deepEqual(mocks.calls.gt, [["expires_at", "2026-05-05T00:01:00.000Z"]]);
    assert.deepEqual(mocks.calls.in, [[
      "action",
      ["adminResolveRelease", "adminResolveRefund"],
    ]]);
    assert.equal((result as { used_at: string }).used_at, "2026-05-05T00:01:00.000Z");
  });

  test("consumePayoutExecutionGrant returns null when no active grant matches", async () => {
    mocks.maybeSingleResult = {
      data: null,
      error: null,
    };

    const result = await consumePayoutExecutionGrant({
      allowedActions: ["confirmRelease"],
      dealId: "deal-id-1",
      issuedToWallet: "0x0000000000000000000000000000000000000002",
      now: "2026-05-05T00:01:00.000Z",
      tokenHash: "hash-1",
    });

    assert.equal(result, null);
  });

  test("wraps create database errors", async () => {
    mocks.singleResult = {
      data: null,
      error: {
        code: "23505",
        message: "duplicate key value",
      },
    };

    await assert.rejects(
      () =>
        createPayoutExecutionGrant({
          action: "confirmRelease",
          dealId: "deal-id-1",
          expiresAt: "2026-05-05T00:02:00.000Z",
          issuedByWallet: "0x0000000000000000000000000000000000000002",
          issuedToWallet: "0x0000000000000000000000000000000000000002",
          tokenHash: "hash-1",
        }),
      (error) => {
        assert.ok(error instanceof PayoutExecutionGrantsRepositoryError);
        assert.equal(error.code, "23505");
        assert.equal(
          error.message,
          "Failed to create payout execution grant: duplicate key value",
        );
        return true;
      },
    );
  });
});
