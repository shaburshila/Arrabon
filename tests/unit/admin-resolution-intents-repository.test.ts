import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  AdminResolutionIntentsRepositoryError,
  consumeLatestAdminResolutionIntent,
} from "../../server/repositories/admin-resolution-intents";

interface AdminResolutionIntentsRepoMocks {
  calls: {
    rpc: Array<[string, Record<string, unknown>]>;
    schema: string[];
  };
  maybeSingleResult: { data: unknown; error: unknown };
  reset: () => void;
}

const mocks = (
  global as typeof globalThis & {
    __adminResolutionIntentsRepoMocks: AdminResolutionIntentsRepoMocks;
  }
).__adminResolutionIntentsRepoMocks;

beforeEach(() => {
  mocks.reset();
});

describe("admin-resolution-intents repository", () => {
  test("consumeLatestAdminResolutionIntent calls RPC with expected params", async () => {
    const result = await consumeLatestAdminResolutionIntent({
      onchainDealId: "42",
      resolution: "release",
    });

    assert.deepEqual(mocks.calls.schema, ["public"]);
    assert.deepEqual(mocks.calls.rpc, [[
      "consume_latest_admin_resolution_intent",
      {
        p_onchain_deal_id: "42",
        p_resolution: "release",
      },
    ]]);
    assert.equal(result?.admin_wallet, "0x0000000000000000000000000000000000000009");
  });

  test("consumeLatestAdminResolutionIntent returns null when no active intent exists", async () => {
    mocks.maybeSingleResult = {
      data: null,
      error: null,
    };

    const result = await consumeLatestAdminResolutionIntent({
      onchainDealId: "42",
      resolution: "refund",
    });

    assert.equal(result, null);
  });

  test("consumeLatestAdminResolutionIntent wraps database errors", async () => {
    mocks.maybeSingleResult = {
      data: null,
      error: {
        code: "PGRST116",
        message: "database failed",
      },
    };

    await assert.rejects(
      () =>
        consumeLatestAdminResolutionIntent({
          onchainDealId: "42",
          resolution: "release",
        }),
      (error) => {
        assert.ok(error instanceof AdminResolutionIntentsRepositoryError);
        assert.equal(error.code, "PGRST116");
        assert.equal(
          error.message,
          "Failed to consume admin resolution intent: database failed",
        );
        return true;
      },
    );
  });
});
