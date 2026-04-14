import "server-only";

import {
  createPublicClient,
  getAddress,
  http,
  toEventSelector,
  type Hex,
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

export type DealEventsWorkerTxRunResult =
  | {
    status: "processed";
    summary: DealEventsWorkerRunSummary;
  }
  | {
    status: "pending_confirmations";
    summary: DealEventsWorkerRunSummary;
  };

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

function getRawEventLogKind(log: Log): RawTaggedDealEventLog["kind"] | null {
  const topic = log.topics[0];

  if (!topic) {
    return null;
  }

  const eventDefinitions = getConsultEscrowEventDefinitions();

  switch (topic) {
    case toEventSelector(eventDefinitions.completed):
      return "Completed";
    case toEventSelector(eventDefinitions.disputed):
      return "Disputed";
    case toEventSelector(eventDefinitions.funded):
      return "Funded";
    case toEventSelector(eventDefinitions.refunded):
      return "Refunded";
    case toEventSelector(eventDefinitions.released):
      return "Released";
    default:
      return null;
  }
}

function tagRawEventLog(log: Log): RawTaggedDealEventLog[] {
  const kind = getRawEventLogKind(log);

  return kind ? [{ kind, log }] : [];
}

async function readAllConfirmedEventLogs(input: {
  fromBlock: bigint;
  toBlock: bigint;
}): Promise<RawTaggedDealEventLog[]> {
  const eventDefinitions = getConsultEscrowEventDefinitions();
  const logs = await dealEventsClient.getLogs({
    address: getConsultEscrowContractAddress(),
    events: [
      eventDefinitions.funded,
      eventDefinitions.completed,
      eventDefinitions.released,
      eventDefinitions.disputed,
      eventDefinitions.refunded,
    ],
    fromBlock: input.fromBlock,
    toBlock: input.toBlock,
  });

  return logs.flatMap(tagRawEventLog);
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

async function processRawEventLogs(
  rawLogs: RawTaggedDealEventLog[],
  summary: DealEventsWorkerRunSummary,
) {
  const sortedLogs = [...rawLogs].sort((left, right) => compareLogs(left.log, right.log));

  for (const rawLog of sortedLogs) {
    const normalizedEvent = await normalizeDealEventLog(rawLog);
    const result = await processConfirmedDealEvent(normalizedEvent);

    summarizeProcessingResult(result, summary);
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
    const rawLogs = await readAllConfirmedEventLogs({
      fromBlock: rangeStart,
      toBlock: rangeEnd,
    });
    // Preserve onchain ordering inside each batch before handing events to the sync service.
    await processRawEventLogs(rawLogs, summary);

    rangeStart = incrementBlock(rangeEnd);
  }

  return summary;
}

export async function runDealEventsWorkerForTx(
  txHash: Hex,
): Promise<DealEventsWorkerTxRunResult> {
  const config = getDealEventsWorkerConfig();
  const [receipt, latestBlock] = await Promise.all([
    dealEventsClient.getTransactionReceipt({ hash: txHash }),
    dealEventsClient.getBlockNumber(),
  ]);
  const confirmedHead = latestBlock - config.confirmations;
  const fromBlock = receipt.blockNumber;
  const summary: DealEventsWorkerRunSummary = {
    alreadyProcessed: 0,
    fromBlock,
    processed: 0,
    skipped: 0,
    toBlock: confirmedHead,
  };

  if (confirmedHead < fromBlock) {
    return {
      status: "pending_confirmations",
      summary,
    };
  }

  const contractAddress = getConsultEscrowContractAddress();
  const rawLogs = receipt.logs
    .filter((log) => getAddress(log.address) === contractAddress)
    .flatMap(tagRawEventLog);

  await processRawEventLogs(rawLogs, summary);

  return {
    status: "processed",
    summary,
  };
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
