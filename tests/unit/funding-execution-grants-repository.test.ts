import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  consumeFundingExecutionGrant,
  createFundingExecutionGrant,
  FundingExecutionGrantsRepositoryError,
} from "../../server/repositories/funding-execution-grants";

interface FundingExecutionGrantsRepoMocks {
  calls: {
    eq: Array<[string, unknown]>;
    gt: Array<[string, unknown]>;
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
    __fundingExecutionGrantsRepoMocks: FundingExecutionGrantsRepoMocks;
  }
).__fundingExecutionGrantsRepoMocks;

beforeEach(() => {
  mocks.reset();
});

describe("funding-execution-grants repository", () => {
  test("createFundingExecutionGrant inserts expected payload", async () => {
    const result = await createFundingExecutionGrant({
      consultationLinkId: "link-id-1",
      expiresAt: "2030-04-27T00:05:00.000Z",
      issuedByWallet: "0x00000000000000000000000000000000000000AA",
      issuedToWallet: "0x00000000000000000000000000000000000000AA",
      tokenHash: "hash-1",
    });

    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.insert, [{
      consultation_link_id: "link-id-1",
      expires_at: "2030-04-27T00:05:00.000Z",
      issued_by_wallet: "0x00000000000000000000000000000000000000AA",
      issued_to_wallet: "0x00000000000000000000000000000000000000AA",
      token_hash: "hash-1",
    }]);
    assert.equal((result as { id: string }).id, "grant-id-1");
  });

  test("consumeFundingExecutionGrant applies atomic consume filters", async () => {
    const result = await consumeFundingExecutionGrant({
      consultationLinkId: "link-id-1",
      issuedToWallet: "0x00000000000000000000000000000000000000AA",
      now: "2030-04-27T00:03:00.000Z",
      tokenHash: "hash-1",
    });

    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.update, [{ used_at: "2030-04-27T00:03:00.000Z" }]);
    assert.deepEqual(mocks.calls.eq, [
      ["token_hash", "hash-1"],
      ["consultation_link_id", "link-id-1"],
      ["issued_to_wallet", "0x00000000000000000000000000000000000000AA"],
    ]);
    assert.deepEqual(mocks.calls.is, [["used_at", null]]);
    assert.deepEqual(mocks.calls.gt, [["expires_at", "2030-04-27T00:03:00.000Z"]]);
    assert.equal((result as { used_at: string }).used_at, "2030-04-27T00:03:00.000Z");
  });

  test("returns null when no active grant matches", async () => {
    mocks.maybeSingleResult = {
      data: null,
      error: null,
    };

    const result = await consumeFundingExecutionGrant({
      consultationLinkId: "link-id-1",
      issuedToWallet: "0x00000000000000000000000000000000000000AA",
      now: "2030-04-27T00:03:00.000Z",
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
        createFundingExecutionGrant({
          consultationLinkId: "link-id-1",
          expiresAt: "2030-04-27T00:05:00.000Z",
          issuedByWallet: "0x00000000000000000000000000000000000000AA",
          issuedToWallet: "0x00000000000000000000000000000000000000AA",
          tokenHash: "hash-1",
        }),
      (error) => {
        assert.ok(error instanceof FundingExecutionGrantsRepositoryError);
        assert.equal(error.code, "23505");
        assert.equal(
          error.message,
          "Failed to create funding execution grant: duplicate key value",
        );
        return true;
      },
    );
  });
});
