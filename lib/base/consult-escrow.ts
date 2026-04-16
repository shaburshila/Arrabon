import {
  decodeEventLog,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
  type Log,
} from "viem";

import { assertLinkHash } from "@/lib/crypto/link-hash";
import {
  autoReleaseFunctionAbi,
  confirmReleaseFunctionAbi,
  createAndFundDealFunctionAbi,
  markCompletedFunctionAbi,
  openDisputeFunctionAbi,
} from "@/lib/base/consult-escrow-abi";

export const dealFundedEventAbi = {
  type: "event",
  name: "DealFunded",
  inputs: [
    { indexed: true, name: "dealId", type: "uint256" },
    { indexed: true, name: "link_hash", type: "bytes32" },
    { indexed: false, name: "seller", type: "address" },
    { indexed: false, name: "buyer", type: "address" },
  ],
  anonymous: false,
} as const;

export const completedEventAbi = {
  type: "event",
  name: "Completed",
  inputs: [
    { indexed: true, name: "dealId", type: "uint256" },
    { indexed: false, name: "completedAt", type: "uint256" },
  ],
  anonymous: false,
} as const;

export const releasedEventAbi = {
  type: "event",
  name: "Released",
  inputs: [
    { indexed: true, name: "dealId", type: "uint256" },
    { indexed: false, name: "releasedAt", type: "uint256" },
  ],
  anonymous: false,
} as const;

export const disputedEventAbi = {
  type: "event",
  name: "Disputed",
  inputs: [{ indexed: true, name: "dealId", type: "uint256" }],
  anonymous: false,
} as const;

export const refundedEventAbi = {
  type: "event",
  name: "Refunded",
  inputs: [{ indexed: true, name: "dealId", type: "uint256" }],
  anonymous: false,
} as const;

export const consultEscrowAbi = [
  createAndFundDealFunctionAbi,
  markCompletedFunctionAbi,
  confirmReleaseFunctionAbi,
  openDisputeFunctionAbi,
  autoReleaseFunctionAbi,
  dealFundedEventAbi,
  completedEventAbi,
  releasedEventAbi,
  disputedEventAbi,
  refundedEventAbi,
] as const;

export interface CreateAndFundDealInput {
  buyerAddress: string;
  durationMinutes: number;
  linkHash: string;
  priceUsdc: string;
  scheduledAt: Date;
  sellerAddress: string;
}

export interface PreparedCreateAndFundDealCall {
  chain_id: number;
  contract_address: Address;
  function_name: "createAndFundDeal";
  args: {
    buyer: Address;
    duration_minutes: string;
    link_hash: string;
    price: string;
    scheduled_at: string;
    seller: Address;
  };
}

export interface PreparedDealLifecycleCall {
  chain_id: number;
  contract_address: Address;
  function_name: "autoRelease" | "confirmRelease" | "markCompleted" | "openDispute";
  args: {
    deal_id: string;
  };
}

export interface NormalizedFundedEvent {
  blockNumber: bigint;
  buyerAddress: Address;
  contractAddress: Address;
  eventType: "Funded";
  // Funding sync does not depend on this timestamp yet, so Phase 4 intentionally leaves it nullable.
  fundedAt: null;
  linkHash: string;
  logIndex: number;
  onchainDealId: string;
  sellerAddress: Address;
  txHash: Hex;
}

export interface NormalizedCompletedEvent {
  blockNumber: bigint;
  // Completion time must always be materialized because release/dispute windows derive from it.
  completedAt: Date;
  contractAddress: Address;
  eventType: "Completed";
  logIndex: number;
  onchainDealId: string;
  txHash: Hex;
}

export interface NormalizedReleasedEvent {
  blockNumber: bigint;
  contractAddress: Address;
  eventType: "Released";
  logIndex: number;
  onchainDealId: string;
  releasedAt: Date;
  txHash: Hex;
}

export interface NormalizedDisputedEvent {
  blockNumber: bigint;
  contractAddress: Address;
  eventType: "Disputed";
  logIndex: number;
  onchainDealId: string;
  txHash: Hex;
}

export interface NormalizedRefundedEvent {
  blockNumber: bigint;
  contractAddress: Address;
  eventType: "Refunded";
  logIndex: number;
  onchainDealId: string;
  txHash: Hex;
}

export type NormalizedDealLifecycleEvent =
  | NormalizedCompletedEvent
  | NormalizedDisputedEvent
  | NormalizedFundedEvent
  | NormalizedRefundedEvent
  | NormalizedReleasedEvent;

export class ConsultEscrowConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConsultEscrowConfigError";
  }
}

function getRequiredEnv(name: "NEXT_PUBLIC_BASE_CHAIN_ID" | "NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS"): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new ConsultEscrowConfigError(`Missing required environment variable: ${name}`);
  }

  return value;
}

function getChainId(): number {
  const rawValue = getRequiredEnv("NEXT_PUBLIC_BASE_CHAIN_ID");
  const chainId = Number(rawValue);

  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new ConsultEscrowConfigError("NEXT_PUBLIC_BASE_CHAIN_ID must be a positive integer.");
  }

  return chainId;
}

function getContractAddress(): Address {
  try {
    return getAddress(getRequiredEnv("NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS"));
  } catch {
    throw new ConsultEscrowConfigError(
      "NEXT_PUBLIC_CONSULT_ESCROW_ADDRESS must be a valid EVM address.",
    );
  }
}

export function getConsultEscrowContractAddress(): Address {
  return getContractAddress();
}

function toUnixSeconds(date: Date): bigint {
  return BigInt(Math.floor(date.getTime() / 1000));
}

function toUint256String(value: bigint): string {
  return value.toString(10);
}

function toHexString(value: string): Hex {
  return value as Hex;
}

function assertLogField<T>(
  value: T | null | undefined,
  field: string,
): T {
  if (value === null || value === undefined) {
    throw new Error(`Missing required event log field: ${field}`);
  }

  return value;
}

export function getConsultEscrowEventAbi() {
  return consultEscrowAbi;
}

export function getConsultEscrowEventDefinitions() {
  return {
    completed: completedEventAbi,
    disputed: disputedEventAbi,
    funded: dealFundedEventAbi,
    refunded: refundedEventAbi,
    released: releasedEventAbi,
  } as const;
}

export function parseFundedEventLog(
  log: Log,
): NormalizedFundedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: dealFundedEventAbi.name,
    topics: log.topics,
  });

  const dealId = decodedLog.args.dealId;
  const linkHash = assertLinkHash(decodedLog.args.link_hash);
  const sellerAddress = getAddress(decodedLog.args.seller);
  const buyerAddress = getAddress(decodedLog.args.buyer);
  const txHash = assertLogField(log.transactionHash, "transactionHash");
  const blockNumber = assertLogField(log.blockNumber, "blockNumber");
  const logIndex = assertLogField(log.logIndex, "logIndex");
  const contractAddress = getAddress(log.address);

  return {
    blockNumber,
    buyerAddress,
    contractAddress,
    eventType: "Funded",
    fundedAt: null,
    linkHash,
    logIndex,
    onchainDealId: dealId.toString(10),
    sellerAddress,
    txHash,
  };
}

function resolveEventTimestamp(timestamp: bigint): Date {
  return new Date(Number(timestamp) * 1000);
}

export function parseCompletedEventLog(
  log: Log,
): NormalizedCompletedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: completedEventAbi.name,
    topics: log.topics,
  });
  const txHash = assertLogField(log.transactionHash, "transactionHash");
  const blockNumber = assertLogField(log.blockNumber, "blockNumber");
  const logIndex = assertLogField(log.logIndex, "logIndex");

  return {
    blockNumber,
    completedAt: resolveEventTimestamp(decodedLog.args.completedAt),
    contractAddress: getAddress(log.address),
    eventType: "Completed",
    logIndex,
    onchainDealId: decodedLog.args.dealId.toString(10),
    txHash,
  };
}

export function parseReleasedEventLog(
  log: Log,
): NormalizedReleasedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: releasedEventAbi.name,
    topics: log.topics,
  });
  const txHash = assertLogField(log.transactionHash, "transactionHash");
  const blockNumber = assertLogField(log.blockNumber, "blockNumber");
  const logIndex = assertLogField(log.logIndex, "logIndex");

  return {
    blockNumber,
    contractAddress: getAddress(log.address),
    eventType: "Released",
    logIndex,
    onchainDealId: decodedLog.args.dealId.toString(10),
    releasedAt: resolveEventTimestamp(decodedLog.args.releasedAt),
    txHash,
  };
}

export function parseDisputedEventLog(
  log: Log,
): NormalizedDisputedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: disputedEventAbi.name,
    topics: log.topics,
  });
  const txHash = assertLogField(log.transactionHash, "transactionHash");
  const blockNumber = assertLogField(log.blockNumber, "blockNumber");
  const logIndex = assertLogField(log.logIndex, "logIndex");

  return {
    blockNumber,
    contractAddress: getAddress(log.address),
    eventType: "Disputed",
    logIndex,
    onchainDealId: decodedLog.args.dealId.toString(10),
    txHash,
  };
}

export function parseRefundedEventLog(
  log: Log,
): NormalizedRefundedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: refundedEventAbi.name,
    topics: log.topics,
  });
  const txHash = assertLogField(log.transactionHash, "transactionHash");
  const blockNumber = assertLogField(log.blockNumber, "blockNumber");
  const logIndex = assertLogField(log.logIndex, "logIndex");

  return {
    blockNumber,
    contractAddress: getAddress(log.address),
    eventType: "Refunded",
    logIndex,
    onchainDealId: decodedLog.args.dealId.toString(10),
    txHash,
  };
}

function prepareDealLifecycleCall(
  functionName: PreparedDealLifecycleCall["function_name"],
  onchainDealId: string,
): PreparedDealLifecycleCall {
  const contractAddress = getContractAddress();
  const chainId = getChainId();

  return {
    chain_id: chainId,
    contract_address: contractAddress,
    function_name: functionName,
    args: {
      deal_id: onchainDealId,
    },
  };
}

export function prepareMarkCompletedCall(onchainDealId: string): PreparedDealLifecycleCall {
  return prepareDealLifecycleCall("markCompleted", onchainDealId);
}

export function prepareConfirmReleaseCall(onchainDealId: string): PreparedDealLifecycleCall {
  return prepareDealLifecycleCall("confirmRelease", onchainDealId);
}

export function prepareOpenDisputeCall(onchainDealId: string): PreparedDealLifecycleCall {
  return prepareDealLifecycleCall("openDispute", onchainDealId);
}

export function prepareAutoReleaseCall(onchainDealId: string): PreparedDealLifecycleCall {
  return prepareDealLifecycleCall("autoRelease", onchainDealId);
}

export function prepareCreateAndFundDealCall(
  input: CreateAndFundDealInput,
): PreparedCreateAndFundDealCall {
  const contractAddress = getContractAddress();
  const chainId = getChainId();
  const seller = getAddress(input.sellerAddress);
  const buyer = getAddress(input.buyerAddress);
  const linkHash = toHexString(assertLinkHash(input.linkHash));
  const price = parseUnits(input.priceUsdc, 6);
  const scheduledAt = toUnixSeconds(input.scheduledAt);
  const durationMinutes = BigInt(input.durationMinutes);

  return {
    chain_id: chainId,
    contract_address: contractAddress,
    function_name: "createAndFundDeal",
    args: {
      buyer,
      duration_minutes: toUint256String(durationMinutes),
      link_hash: linkHash,
      price: toUint256String(price),
      scheduled_at: toUint256String(scheduledAt),
      seller,
    },
  };
}
