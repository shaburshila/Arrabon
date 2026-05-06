import "server-only";

import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  simulateContract,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";

import { getConsultEscrowContractAddress, ConsultEscrowConfigError } from "@/lib/base/consult-escrow";
import { setDealPayoutBlockedFunctionAbi } from "@/lib/base/consult-escrow-abi";
import { baseRuntimeConfig } from "@/lib/base/config";

const COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY_ENV = "COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY";
const PRIVATE_KEY_PATTERN = /^0x[0-9a-fA-F]{64}$/;

function getComplianceHoldSignerPrivateKey(): Hex {
  const value = process.env[COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY_ENV]?.trim();

  if (!value) {
    throw new ConsultEscrowConfigError(
      `Missing required environment variable: ${COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY_ENV}`,
    );
  }

  if (!PRIVATE_KEY_PATTERN.test(value)) {
    throw new ConsultEscrowConfigError(
      `${COMPLIANCE_HOLD_SIGNER_PRIVATE_KEY_ENV} must be a 32-byte hex private key.`,
    );
  }

  return value as Hex;
}

export function getComplianceHoldSignerAddress(): `0x${string}` {
  return privateKeyToAccount(getComplianceHoldSignerPrivateKey()).address;
}

export async function applyDealPayoutBlock(
  onchainDealId: string,
  blocked: boolean,
): Promise<Hex> {
  const account = privateKeyToAccount(getComplianceHoldSignerPrivateKey());
  const publicClient = createPublicClient({
    chain: baseRuntimeConfig.chain,
    transport: http(baseRuntimeConfig.rpcUrl),
  });
  const walletClient = createWalletClient({
    account,
    chain: baseRuntimeConfig.chain,
    transport: http(baseRuntimeConfig.rpcUrl),
  });
  const { request } = await simulateContract(publicClient, {
    account,
    address: getConsultEscrowContractAddress(),
    args: [BigInt(onchainDealId), blocked],
    abi: [setDealPayoutBlockedFunctionAbi],
    chain: baseRuntimeConfig.chain,
    functionName: "setDealPayoutBlocked",
  });
  const hash = await writeContract(walletClient, request);

  await waitForTransactionReceipt(publicClient, {
    confirmations: 1,
    hash,
  });

  return hash;
}

export function isInvalidStateTransitionHoldError(error: unknown): boolean {
  if (!(error instanceof BaseError)) {
    return false;
  }

  const revertedError = error.walk(
    (candidate) => candidate instanceof ContractFunctionRevertedError,
  ) as ContractFunctionRevertedError | undefined;

  return revertedError?.data?.errorName === "InvalidStateTransition";
}
