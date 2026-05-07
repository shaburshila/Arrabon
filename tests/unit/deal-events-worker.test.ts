import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";

import {
  runDealEventsWorker,
  runDealEventsWorkerForTx,
} from "@/server/workers/deal-events";

interface DealEventsWorkerMocks {
  advanceDealEventsSyncCursor: (...args: unknown[]) => Promise<bigint>;
  client: {
    getBlockNumber: (...args: unknown[]) => Promise<bigint>;
    getLogs: (...args: unknown[]) => Promise<unknown[]>;
    getTransactionReceipt: (...args: unknown[]) => Promise<{
      blockNumber: bigint;
      logs: Array<{ address: string; topics?: string[] }>;
    }>;
  };
  getByTxHash: (...args: unknown[]) => Promise<{
    deal_id: string | null;
    hold_applied: boolean | null;
    tx_hash: string;
  } | null>;
  getConsultEscrowContractAddress: (...args: unknown[]) => string;
  getConsultEscrowEventDefinitions: (...args: unknown[]) => Record<string, string>;
  initializeDealEventsSyncCursorIfMissing: (...args: unknown[]) => Promise<bigint>;
  parseCompletedEventLog: (...args: unknown[]) => Promise<unknown>;
  parseDisputedEventLog: (...args: unknown[]) => Promise<unknown>;
  parseFundedEventLog: (...args: unknown[]) => Promise<unknown>;
  parseRefundedEventLog: (...args: unknown[]) => Promise<unknown>;
  parseReleasedEventLog: (...args: unknown[]) => Promise<unknown>;
  processConfirmedDealEvent: (...args: unknown[]) => Promise<{ result: "processed" | "already_processed" | "skipped" }>;
  processPendingDenylistHoldSweeps: (...args: unknown[]) => Promise<void>;
  processPendingDealRiskRecomputeSweeps: (...args: unknown[]) => Promise<void>;
  processPendingFundingHoldForProcessedTransaction: (...args: unknown[]) => Promise<void>;
  processPendingFundingHoldSweeps: (...args: unknown[]) => Promise<void>;
}

const mocks = (global as typeof globalThis & { __dealEventsWorkerMocks: DealEventsWorkerMocks })
  .__dealEventsWorkerMocks;

beforeEach(() => {
  process.env.CHAIN_SYNC_CONFIRMATIONS = "0";
  process.env.CHAIN_SYNC_MAX_RANGE = "2";
  process.env.CHAIN_SYNC_START_BLOCK = "100";

  mocks.advanceDealEventsSyncCursor = async (value: unknown) => BigInt(value as bigint);
  mocks.client = {
    getBlockNumber: async () => BigInt(100),
    getLogs: async () => [],
    getTransactionReceipt: async () => ({
      blockNumber: BigInt(100),
      logs: [],
    }),
  };
  mocks.getByTxHash = async () => null;
  mocks.getConsultEscrowContractAddress = () => "0x0000000000000000000000000000000000000001";
  mocks.getConsultEscrowEventDefinitions = () => ({
    completed: "completed",
    disputed: "disputed",
    funded: "funded",
    refunded: "refunded",
    released: "released",
  });
  mocks.initializeDealEventsSyncCursorIfMissing = async () => BigInt(99);
  mocks.parseCompletedEventLog = async () => ({ type: "Completed" });
  mocks.parseDisputedEventLog = async () => ({ type: "Disputed" });
  mocks.parseFundedEventLog = async () => ({ type: "Funded" });
  mocks.parseRefundedEventLog = async () => ({ type: "Refunded" });
  mocks.parseReleasedEventLog = async () => ({ type: "Released" });
  mocks.processConfirmedDealEvent = async () => ({ result: "processed" });
  mocks.processPendingDenylistHoldSweeps = async () => undefined;
  mocks.processPendingDealRiskRecomputeSweeps = async () => undefined;
  mocks.processPendingFundingHoldForProcessedTransaction = async () => undefined;
  mocks.processPendingFundingHoldSweeps = async () => undefined;
});

test("initializes cursor from CHAIN_SYNC_START_BLOCK and advances it after each processed batch", async () => {
  const getLogsCalls: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  const advanceCalls: bigint[] = [];
  let fundingSweepCalls = 0;
  let denylistSweepCalls = 0;
  let recomputeSweepCalls = 0;

  mocks.client.getBlockNumber = async () => BigInt(104);
  mocks.client.getLogs = async (input: unknown) => {
    getLogsCalls.push(input as { fromBlock: bigint; toBlock: bigint });
    return [];
  };
  mocks.initializeDealEventsSyncCursorIfMissing = async (startBlock: unknown) => {
    assert.equal(startBlock, BigInt(100));
    return BigInt(99);
  };
  mocks.advanceDealEventsSyncCursor = async (value: unknown) => {
    advanceCalls.push(value as bigint);
    return value as bigint;
  };
  mocks.processPendingFundingHoldSweeps = async () => {
    fundingSweepCalls += 1;
  };
  mocks.processPendingDenylistHoldSweeps = async () => {
    denylistSweepCalls += 1;
  };
  mocks.processPendingDealRiskRecomputeSweeps = async () => {
    recomputeSweepCalls += 1;
  };

  const summary = await runDealEventsWorker();

  assert.deepEqual(getLogsCalls.map(({ fromBlock, toBlock }) => ({ fromBlock, toBlock })), [
    { fromBlock: BigInt(100), toBlock: BigInt(101) },
    { fromBlock: BigInt(102), toBlock: BigInt(103) },
    { fromBlock: BigInt(104), toBlock: BigInt(104) },
  ]);
  assert.deepEqual(advanceCalls, [BigInt(101), BigInt(103), BigInt(104)]);
  assert.equal(summary.fromBlock, BigInt(100));
  assert.equal(summary.toBlock, BigInt(104));
  assert.equal(fundingSweepCalls, 1);
  assert.equal(denylistSweepCalls, 1);
  assert.equal(recomputeSweepCalls, 1);
});

test("preserves already-advanced cursor progress when a later batch fails", async () => {
  const advanceCalls: bigint[] = [];
  let batchIndex = 0;
  let fundingSweepCalls = 0;

  mocks.client.getBlockNumber = async () => BigInt(104);
  mocks.client.getLogs = async () => {
    batchIndex += 1;
    if (batchIndex === 2) {
      throw new Error("rpc down");
    }
    return [];
  };
  mocks.advanceDealEventsSyncCursor = async (value: unknown) => {
    advanceCalls.push(value as bigint);
    return value as bigint;
  };
  mocks.processPendingFundingHoldSweeps = async () => {
    fundingSweepCalls += 1;
  };

  await assert.rejects(() => runDealEventsWorker(), /rpc down/);

  assert.deepEqual(advanceCalls, [BigInt(101)]);
  assert.equal(fundingSweepCalls, 0);
});

test("does not move cursor when there is no confirmed backlog to process", async () => {
  const advanceCalls: bigint[] = [];

  mocks.client.getBlockNumber = async () => BigInt(199);
  mocks.initializeDealEventsSyncCursorIfMissing = async () => BigInt(200);
  mocks.advanceDealEventsSyncCursor = async (value: unknown) => {
    advanceCalls.push(value as bigint);
    return value as bigint;
  };

  const summary = await runDealEventsWorker();

  assert.equal(summary.fromBlock, BigInt(201));
  assert.equal(summary.toBlock, BigInt(199));
  assert.deepEqual(advanceCalls, []);
});

test("tx-scoped worker path remains isolated from global cursor state", async () => {
  const initializeCalls: unknown[][] = [];
  const advanceCalls: unknown[][] = [];

  mocks.client.getBlockNumber = async () => BigInt(500);
  mocks.client.getTransactionReceipt = async () => ({
    blockNumber: BigInt(500),
    logs: [],
  });
  mocks.initializeDealEventsSyncCursorIfMissing = async (...args: unknown[]) => {
    initializeCalls.push(args);
    return BigInt(99);
  };
  mocks.advanceDealEventsSyncCursor = async (...args: unknown[]) => {
    advanceCalls.push(args);
    return BigInt(0);
  };

  const result = await runDealEventsWorkerForTx(`0x${"a".repeat(64)}`);

  assert.equal(result.status, "processed");
  assert.deepEqual(initializeCalls, []);
  assert.deepEqual(advanceCalls, []);
});
