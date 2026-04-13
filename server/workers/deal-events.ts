import "server-only";

import {
  createPublicClient,
  http,
  type Log,
} from "viem";

import {
  getConsultEscrowEventDefinitions,
  getConsultEscrowContractAddress,
  parseCompletedEventLog,
  parseDisputedEventLog,
  parseFundedEventLog,
  parseRefundedEventLog,
  parseReleasedEventLog,
  type NormalizedDealLifecycleEvent,
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

export interface SerializedDealEventsWorkerRunSummary {
  alreadyProcessed: number;
  fromBlock: string;
  processed: number;
  skipped: number;
  toBlock: string;
}

type RawTaggedDealEventLog =
  | { kind: "Completed"; log: Log }
  | { kind: "Disputed"; log: Log }
  | { kind: "Funded"; log: Log }
  | { kind: "Refunded"; log: Log }
  | { kind: "Released"; log: Log };

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

const dealEventsClient = getDealEventsClient();

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
}): Promise<RawTaggedDealEventLog[]> {
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventDefinitions().funded,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.map((log) => ({
    kind: "Funded",
    log,
  }));
}

async function readConfirmedCompletedLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<RawTaggedDealEventLog[]> {
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventDefinitions().completed,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.map((log) => ({
    kind: "Completed",
    log,
  }));
}

async function readConfirmedReleasedLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<RawTaggedDealEventLog[]> {
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventDefinitions().released,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.map((log) => ({
    kind: "Released",
    log,
  }));
}

async function readConfirmedDisputedLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<RawTaggedDealEventLog[]> {
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventDefinitions().disputed,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.map((log) => ({
    kind: "Disputed",
    log,
  }));
}

async function readConfirmedRefundedLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<RawTaggedDealEventLog[]> {
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    event: getConsultEscrowEventDefinitions().refunded,
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.map((log) => ({
    kind: "Refunded",
    log,
  }));
}

async function normalizeDealEventLog(
  rawEventLog: RawTaggedDealEventLog,
): Promise<NormalizedDealLifecycleEvent> {
  switch (rawEventLog.kind) {
    case "Completed":
      return parseCompletedEventLog(rawEventLog.log);
    case "Disputed":
      return parseDisputedEventLog(rawEventLog.log);
    case "Funded":
      return parseFundedEventLog(rawEventLog.log);
    case "Refunded":
      return parseRefundedEventLog(rawEventLog.log);
    case "Released":
      return parseReleasedEventLog(rawEventLog.log);
  }
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

export async function runDealEventsWorker(
  fromBlockOverride?: bigint,
): Promise<DealEventsWorkerRunSummary> {
  const config = getDealEventsWorkerConfig();
  const fromBlock = fromBlockOverride ?? config.fromBlock;
  const latestBlock = await dealEventsClient.getBlockNumber();
  const confirmedHead = latestBlock - config.confirmations;

  if (confirmedHead < fromBlock) {
    return {
      alreadyProcessed: 0,
      fromBlock,
      processed: 0,
      skipped: 0,
      toBlock: confirmedHead,
    };
  }

  const summary: DealEventsWorkerRunSummary = {
    alreadyProcessed: 0,
    fromBlock,
    processed: 0,
    skipped: 0,
    toBlock: confirmedHead,
  };

  let rangeStart = fromBlock;
  while (rangeStart <= confirmedHead) {
    const rangeEnd = resolveRangeEnd(rangeStart, confirmedHead, config.maxRange);
    const [fundedLogs, completedLogs, releasedLogs, disputedLogs, refundedLogs] = await Promise.all([
      readConfirmedFundingLogs({
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      }),
      readConfirmedCompletedLogs({
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      }),
      readConfirmedReleasedLogs({
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      }),
      readConfirmedDisputedLogs({
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      }),
      readConfirmedRefundedLogs({
        fromBlock: rangeStart,
        toBlock: rangeEnd,
      }),
    ]);
    const rawLogs: RawTaggedDealEventLog[] = [
      ...fundedLogs,
      ...completedLogs,
      ...releasedLogs,
      ...disputedLogs,
      ...refundedLogs,
    ];
    // Preserve onchain ordering inside each batch before handing events to the sync service.
    const sortedLogs = [...rawLogs].sort((left, right) => compareLogs(left.log, right.log));

    for (const rawLog of sortedLogs) {
      const normalizedEvent = await normalizeDealEventLog(rawLog);
      const result = await processConfirmedDealEvent(normalizedEvent);

      summarizeProcessingResult(result, summary);
    }

    rangeStart = incrementBlock(rangeEnd);
  }

  return summary;
}

export function serializeDealEventsWorkerRunSummary(
  summary: DealEventsWorkerRunSummary,
): SerializedDealEventsWorkerRunSummary {
  return {
    alreadyProcessed: summary.alreadyProcessed,
    fromBlock: summary.fromBlock.toString(10),
    processed: summary.processed,
    skipped: summary.skipped,
    toBlock: summary.toBlock.toString(10),
  };
}
