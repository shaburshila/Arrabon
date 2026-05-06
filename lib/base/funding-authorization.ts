import "server-only";

import { randomBytes } from "node:crypto";

import { getAddress, keccak256, stringToBytes, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";

import {
  ConsultEscrowConfigError,
  getConsultEscrowChainId,
  getConsultEscrowContractAddress,
} from "@/lib/base/consult-escrow";

const FUNDING_AUTHORIZER_PRIVATE_KEY_ENV = "FUNDING_AUTHORIZER_PRIVATE_KEY";
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

export const FUNDING_AUTHORIZATION_DOMAIN = {
  name: "ConsultEscrow",
  version: "1",
} as const;

export const FUNDING_AUTHORIZATION_TYPES = {
  FundingAuthorization: [
    { name: "consultationLinkIdHash", type: "bytes32" },
    { name: "buyer", type: "address" },
    { name: "seller", type: "address" },
    { name: "linkHash", type: "bytes32" },
    { name: "price", type: "uint256" },
    { name: "scheduledAt", type: "uint256" },
    { name: "durationMinutes", type: "uint256" },
    { name: "linkExpiresAt", type: "uint256" },
    { name: "deadline", type: "uint256" },
    { name: "nonce", type: "bytes32" },
  ],
} as const;

export interface FundingAuthorizationMessage {
  buyer: `0x${string}`;
  consultationLinkIdHash: `0x${string}`;
  deadline: bigint;
  durationMinutes: bigint;
  linkHash: `0x${string}`;
  linkExpiresAt: bigint;
  nonce: `0x${string}`;
  price: bigint;
  scheduledAt: bigint;
  seller: `0x${string}`;
}

export interface FundingAuthorizationResult {
  deadline: bigint;
  nonce: Hex;
  signature: Hex;
}

function getFundingAuthorizerPrivateKey(): Hex {
  const value = process.env[FUNDING_AUTHORIZER_PRIVATE_KEY_ENV]?.trim();

  if (!value) {
    throw new ConsultEscrowConfigError(
      `Missing required environment variable: ${FUNDING_AUTHORIZER_PRIVATE_KEY_ENV}`,
    );
  }

  if (!PRIVATE_KEY_PATTERN.test(value)) {
    throw new ConsultEscrowConfigError(
      `${FUNDING_AUTHORIZER_PRIVATE_KEY_ENV} must be a 32-byte hex private key.`,
    );
  }

  return value as Hex;
}

export function getFundingAuthorizerAddress(): `0x${string}` {
  return getAddress(privateKeyToAccount(getFundingAuthorizerPrivateKey()).address);
}

export function createFundingAuthorizationNonce(): Hex {
  return `0x${randomBytes(32).toString("hex")}` as Hex;
}

export function hashConsultationLinkId(linkId: string): Hex {
  return keccak256(stringToBytes(linkId));
}

export async function signFundingAuthorization(
  message: FundingAuthorizationMessage,
): Promise<Hex> {
  const account = privateKeyToAccount(getFundingAuthorizerPrivateKey());

  return account.signTypedData({
    domain: {
      ...FUNDING_AUTHORIZATION_DOMAIN,
      chainId: getConsultEscrowChainId(),
      verifyingContract: getConsultEscrowContractAddress(),
    },
    message,
    primaryType: "FundingAuthorization",
    types: FUNDING_AUTHORIZATION_TYPES,
  });
}
