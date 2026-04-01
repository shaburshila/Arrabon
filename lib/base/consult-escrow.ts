import {
  decodeEventLog,
  getAddress,
  parseUnits,
  type Address,
  type Hex,
  type Log,
} from "viem";

import { assertLinkHash } from "@/lib/crypto/link-hash";

export const consultEscrowAbi = [
  {
    type: "function",
    name: "createAndFundDeal",
    stateMutability: "nonpayable",
    inputs: [
      { name: "link_hash", type: "bytes32" },
      { name: "seller", type: "address" },
      { name: "buyer", type: "address" },
      { name: "price", type: "uint256" },
      { name: "scheduled_at", type: "uint256" },
      { name: "duration_minutes", type: "uint256" },
      { name: "grace_period_minutes", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "event",
    name: "DealFunded",
    inputs: [
      { indexed: true, name: "dealId", type: "uint256" },
      { indexed: true, name: "link_hash", type: "bytes32" },
      { indexed: false, name: "seller", type: "address" },
      { indexed: false, name: "buyer", type: "address" },
    ],
    anonymous: false,
  },
] as const;

export interface CreateAndFundDealInput {
  buyerAddress: string;
  durationMinutes: number;
  gracePeriodMinutes: number;
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
    grace_period_minutes: string;
    link_hash: string;
    price: string;
    scheduled_at: string;
    seller: Address;
  };
}

export interface NormalizedFundedEvent {
  blockNumber: bigint;
  buyerAddress: Address;
  contractAddress: Address;
  eventType: "Funded";
  fundedAt: null;
  linkHash: string;
  logIndex: number;
  onchainDealId: string;
  sellerAddress: Address;
  txHash: Hex;
}

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

export function parseFundedEventLog(
  log: Log,
): NormalizedFundedEvent {
  const decodedLog = decodeEventLog({
    abi: consultEscrowAbi,
    data: log.data,
    eventName: "DealFunded",
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
  const gracePeriodMinutes = BigInt(input.gracePeriodMinutes);

  return {
    chain_id: chainId,
    contract_address: contractAddress,
    function_name: "createAndFundDeal",
    args: {
      buyer,
      duration_minutes: toUint256String(durationMinutes),
      grace_period_minutes: toUint256String(gracePeriodMinutes),
      link_hash: linkHash,
      price: toUint256String(price),
      scheduled_at: toUint256String(scheduledAt),
      seller,
    },
  };
}
