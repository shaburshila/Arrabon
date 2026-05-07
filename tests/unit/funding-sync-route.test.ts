import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import { POST } from "../../app/api/links/[id]/funding/sync/route";

interface FundingSyncRouteMocks {
  classifyDealEventsWorkerError: (...args: unknown[]) => {
    code: string;
    type: string;
  };
  getDealByTxHash: (...args: unknown[]) => Promise<{
    consultation_link_id: string;
  } | null>;
  parsePrepareFundingParams: (...args: unknown[]) => { linkId: string };
  requireUser: (...args: unknown[]) => Promise<{
    avatar_url: null;
    expires_at: string;
    id: string;
    is_admin: boolean;
    username: null;
    wallet_address: string;
  }>;
  runDealEventsWorker: (...args: unknown[]) => Promise<unknown>;
  runDealEventsWorkerForTx: (...args: unknown[]) => Promise<{
    status: "processed" | "pending_confirmations";
    summary: {
      alreadyProcessed: number;
      backlogBlocks: bigint;
      batchesProcessed: number;
      fromBlock: bigint;
      processed: number;
      skipped: number;
      toBlock: bigint;
    };
  }>;
  serializeDealEventsWorkerRunSummary: (...args: unknown[]) => {
    alreadyProcessed: number;
    backlogBlocks: string;
    batchesProcessed: number;
    fromBlock: string;
    processed: number;
    skipped: number;
    toBlock: string;
  };
}

const mocks = (global as typeof globalThis & { __fundingSyncRouteMocks: FundingSyncRouteMocks })
  .__fundingSyncRouteMocks;

beforeEach(() => {
  mocks.classifyDealEventsWorkerError = () => ({
    code: "DEAL_EVENTS_WORKER_FAILED",
    type: "fatal",
  });
  mocks.getDealByTxHash = async () => ({
    consultation_link_id: "11111111-1111-4111-8111-111111111111",
  });
  mocks.parsePrepareFundingParams = (...args: unknown[]) => ({
    linkId:
      ((args[0] as { id?: string | undefined } | undefined)?.id)
      ?? "11111111-1111-4111-8111-111111111111",
  });
  mocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
  mocks.runDealEventsWorker = async () => ({
    alreadyProcessed: 0,
    fromBlock: BigInt(0),
    processed: 0,
    skipped: 0,
    toBlock: BigInt(0),
  });
  mocks.runDealEventsWorkerForTx = async () => ({
    status: "processed",
    summary: {
      alreadyProcessed: 0,
      backlogBlocks: BigInt(0),
      batchesProcessed: 0,
      fromBlock: BigInt(0),
      processed: 1,
      skipped: 0,
      toBlock: BigInt(0),
    },
  });
  mocks.serializeDealEventsWorkerRunSummary = (...args: unknown[]) => {
    const summary = args[0] as {
      alreadyProcessed: number;
      backlogBlocks: bigint;
      batchesProcessed: number;
      fromBlock: bigint;
      processed: number;
      skipped: number;
      toBlock: bigint;
    };

    return {
      alreadyProcessed: summary.alreadyProcessed,
      backlogBlocks: summary.backlogBlocks.toString(),
      batchesProcessed: summary.batchesProcessed,
      fromBlock: summary.fromBlock.toString(),
      processed: summary.processed,
      skipped: summary.skipped,
      toBlock: summary.toBlock.toString(),
    };
  };
});

test("tx_hash happy path remains supported", async () => {
  const response = await POST(
    new Request("http://localhost/api/links/11111111-1111-4111-8111-111111111111/funding/sync", {
      body: JSON.stringify({
        tx_hash: `0x${"a".repeat(64)}`,
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    },
  );

  assert.ok(response);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    ok: true,
    status: "success",
    summary: {
      alreadyProcessed: 0,
      backlogBlocks: "0",
      batchesProcessed: 0,
      fromBlock: "0",
      processed: 1,
      skipped: 0,
      toBlock: "0",
    },
  });
});

test("missing tx_hash returns 400 INVALID_TX_HASH", async () => {
  let broadWorkerCalled = false;
  mocks.runDealEventsWorker = async () => {
    broadWorkerCalled = true;
    return {
      alreadyProcessed: 0,
      fromBlock: BigInt(0),
      processed: 0,
      skipped: 0,
      toBlock: BigInt(0),
    };
  };

  const response = await POST(
    new Request("http://localhost/api/links/11111111-1111-4111-8111-111111111111/funding/sync", {
      body: JSON.stringify({}),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    },
  );

  assert.ok(response);
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "INVALID_TX_HASH",
    error: "Invalid funding preparation input.",
    ok: false,
    status: "fatal",
  });
  assert.equal(broadWorkerCalled, false);
});

test("from_block is rejected with 403 FROM_BLOCK_NOT_ALLOWED", async () => {
  let broadWorkerCalled = false;
  mocks.runDealEventsWorker = async () => {
    broadWorkerCalled = true;
    return {
      alreadyProcessed: 0,
      fromBlock: BigInt(0),
      processed: 0,
      skipped: 0,
      toBlock: BigInt(0),
    };
  };

  const response = await POST(
    new Request("http://localhost/api/links/11111111-1111-4111-8111-111111111111/funding/sync", {
      body: JSON.stringify({
        from_block: "123",
      }),
      headers: {
        "content-type": "application/json",
      },
      method: "POST",
    }),
    {
      params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }),
    },
  );

  assert.ok(response);
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), {
    code: "FROM_BLOCK_NOT_ALLOWED",
    error: "from_block is not allowed for this endpoint.",
    ok: false,
    status: "fatal",
  });
  assert.equal(broadWorkerCalled, false);
});
