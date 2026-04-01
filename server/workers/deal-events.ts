import "server-only";

import {
  createPublicClient,
  http,
  type Log,
} from "viem";

import {
  getConsultEscrowContractAddress,
  getConsultEscrowEventAbi,
  parseFundedEventLog,
} from "@/lib/base/consult-escrow";
import { baseRuntimeConfig } from "@/lib/base/config";
import {
  processConfirmedDealEvent,
  type DealEventProcessingResult,
} from "@/server/services/deal-events";

const DEFAULT_CHAIN_SYNC_CONFIRMATIONS = BigInt(12);
const DEFAULT_CHAIN_SYNC_MAX_RANGE = BigInt(2000);

export interface DealEventsWorkerConfig {
  confirmations: bigint;
  fromBlock: bigint;
  maxRange: bigint;
}

export interface DealEventsWorkerRunSummary {
  alreadyProcessed: number;
  fromBlock: bigint;
  processed: number;
  skipped: number;
  toBlock: bigint;
}

function readPositiveBigIntEnv(
  name: "CHAIN_SYNC_CONFIRMATIONS" | "CHAIN_SYNC_MAX_RANGE" | "CHAIN_SYNC_START_BLOCK",
  fallback: bigint,
): bigint {
  const rawValue = process.env[name]?.trim();

  if (!rawValue) {
    return fallback;
  }

  let parsedValue: bigint;

  try {
    parsedValue = BigInt(rawValue);
  } catch {
    throw new Error(`${name} must be a valid integer.`);
  }

  if (parsedValue < BigInt(0)) {
    throw new Error(`${name} must be a non-negative integer.`);
  }

  return parsedValue;
}

export function getDealEventsWorkerConfig(): DealEventsWorkerConfig {
  const maxRange = readPositiveBigIntEnv(
    "CHAIN_SYNC_MAX_RANGE",
    DEFAULT_CHAIN_SYNC_MAX_RANGE,
  );

  if (maxRange < BigInt(1)) {
    throw new Error("CHAIN_SYNC_MAX_RANGE must be greater than or equal to 1.");
  }

  return {
    confirmations: readPositiveBigIntEnv(
      "CHAIN_SYNC_CONFIRMATIONS",
      DEFAULT_CHAIN_SYNC_CONFIRMATIONS,
    ),
    fromBlock: readPositiveBigIntEnv("CHAIN_SYNC_START_BLOCK", BigInt(0)),
    maxRange,
  };
}

function getDealEventsClient() {
  return createPublicClient({
    chain: baseRuntimeConfig.chain,
    transport: http(baseRuntimeConfig.rpcUrl),
  });
}

function compareLogs(left: Log, right: Log): number {
  const leftBlock = left.blockNumber ?? BigInt(0);
  const rightBlock = right.blockNumber ?? BigInt(0);

  if (leftBlock < rightBlock) {
    return -1;
  }

  if (leftBlock > rightBlock) {
    return 1;
  }

  const leftIndex = left.logIndex ?? 0;
  const rightIndex = right.logIndex ?? 0;

  return leftIndex - rightIndex;
}

function incrementBlock(blockNumber: bigint): bigint {
  return blockNumber + BigInt(1);
}

function resolveRangeEnd(
  rangeStart: bigint,
  confirmedHead: bigint,
  maxRange: bigint,
): bigint {
  const candidateEnd = rangeStart + maxRange - BigInt(1);

  return candidateEnd < confirmedHead ? candidateEnd : confirmedHead;
}

async function readConfirmedFundingLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}) {
  const client = getDealEventsClient();

  return client.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventAbi()[1],
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });
}

function summarizeProcessingResult(
  result: DealEventProcessingResult,
  summary: DealEventsWorkerRunSummary,
) {
  switch (result.result) {
    case "already_processed":
      summary.alreadyProcessed += 1;
      return;
    case "processed":
      summary.processed += 1;
      return;
    case "skipped":
      summary.skipped += 1;
      return;
  }
}

export async function runDealEventsWorker(): Promise<DealEventsWorkerRunSummary> {
  const config = getDealEventsWorkerConfig();
  const client = getDealEventsClient();
  const latestBlock = await client.getBlockNumber();
  const confirmedHead = latestBlock - config.confirmations;

  if (confirmedHead < config.fromBlock) {
    return {
      alreadyProcessed: 0,
      fromBlock: config.fromBlock,
      processed: 0,
      skipped: 0,
      toBlock: confirmedHead,
    };
  }

  const summary: DealEventsWorkerRunSummary = {
    alreadyProcessed: 0,
    fromBlock: config.fromBlock,
    processed: 0,
    skipped: 0,
    toBlock: confirmedHead,
  };

  let rangeStart = config.fromBlock;

  while (rangeStart <= confirmedHead) {
    const rangeEnd = resolveRangeEnd(rangeStart, confirmedHead, config.maxRange);
    const rawLogs = await readConfirmedFundingLogs({
      fromBlock: rangeStart,
      toBlock: rangeEnd,
    });
    const sortedLogs = [...rawLogs].sort(compareLogs);

    for (const rawLog of sortedLogs) {
      const normalizedEvent = parseFundedEventLog(rawLog);
      const result = await processConfirmedDealEvent(normalizedEvent);

      summarizeProcessingResult(result, summary);
    }

    rangeStart = incrementBlock(rangeEnd);
  }

  return summary;
}
