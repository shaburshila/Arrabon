// Executes backend-prepared contract calls via wagmi sendTransaction.
// Frontend never builds calldata independently — it only executes what the backend prepares.
// dataSuffix (Builder Code) is appended to all calls when NEXT_PUBLIC_BUILDER_CODE is set.

import { sendTransaction, waitForTransactionReceipt } from "@wagmi/core";
import { encodeFunctionData, getAddress, type Address, type Hex } from "viem";
import type { Config } from "wagmi";

import {
  adminResolveRefundFunctionAbi,
  adminResolveReleaseFunctionAbi,
  autoReleaseFunctionAbi,
  createAndFundDealFunctionAbi,
  markCompletedFunctionAbi,
  confirmReleaseFunctionAbi,
  openDisputeFunctionAbi,
} from "@/lib/base/consult-escrow-abi";
import { baseRuntimeConfig } from "@/lib/base/config";
import type { FundingContractCall } from "@/lib/api/links";
import type { LifecycleContractCall } from "@/lib/api/deals";
import type { AdminContractCall } from "@/lib/api/admin-deals";

export class TransactionRevertedError extends Error {
  txHash: Hex;

  constructor(txHash: Hex) {
    super("Transaction reverted.");
    this.name = "TransactionRevertedError";
    this.txHash = txHash;
  }
}

// Append Builder Code dataSuffix if configured.
// Format: raw hex bytes appended after function calldata.
function withBuilderCodeSuffix(data: Hex): Hex {
  const builderCode = baseRuntimeConfig.builderCode;
  if (!builderCode) return data;
  // Strip 0x prefix from suffix and append
  const suffix = builderCode.startsWith("0x") ? builderCode.slice(2) : builderCode;
  return (data + suffix) as Hex;
}

// Execute a backend-prepared createAndFundDeal call.
// Returns the tx hash immediately after submission.
export async function executeFundingCall(
  config: Config,
  contractCall: FundingContractCall,
): Promise<Hex> {
  const { args, contract_address } = contractCall;

  const encodedData = encodeFunctionData({
    abi: [createAndFundDealFunctionAbi],
    args: [
      args.link_hash as Hex,
      getAddress(args.seller) as Address,
      getAddress(args.buyer) as Address,
      BigInt(args.price),
      BigInt(args.scheduled_at),
      BigInt(args.duration_minutes),
    ],
    functionName: "createAndFundDeal",
  });

  return sendTransaction(config, {
    chainId: contractCall.chain_id,
    data: withBuilderCodeSuffix(encodedData),
    to: getAddress(contract_address),
  });
}

// Execute a backend-prepared lifecycle call.
// args.deal_id from backend is the onchain uint256 deal id as a decimal string.
export async function executeLifecycleCall(
  config: Config,
  contractCall: LifecycleContractCall,
): Promise<Hex> {
  const { args, contract_address, function_name } = contractCall;
  const onchainDealId = BigInt(args.deal_id);

  let encodedData: Hex;

  if (function_name === "markCompleted") {
    encodedData = encodeFunctionData({
      abi: [markCompletedFunctionAbi],
      args: [onchainDealId],
      functionName: "markCompleted",
    });
  } else if (function_name === "confirmRelease") {
    encodedData = encodeFunctionData({
      abi: [confirmReleaseFunctionAbi],
      args: [onchainDealId],
      functionName: "confirmRelease",
    });
  } else if (function_name === "autoRelease") {
    encodedData = encodeFunctionData({
      abi: [autoReleaseFunctionAbi],
      args: [onchainDealId],
      functionName: "autoRelease",
    });
  } else {
    encodedData = encodeFunctionData({
      abi: [openDisputeFunctionAbi],
      args: [onchainDealId],
      functionName: "openDispute",
    });
  }

  return sendTransaction(config, {
    chainId: contractCall.chain_id,
    data: withBuilderCodeSuffix(encodedData),
    to: getAddress(contract_address),
  });
}

// Execute a backend-prepared admin dispute resolution call.
// args.deal_id from backend is the onchain uint256 deal id as a decimal string.
export async function executeAdminCall(
  config: Config,
  contractCall: AdminContractCall,
): Promise<Hex> {
  const { args, contract_address, function_name } = contractCall;
  const onchainDealId = BigInt(args.deal_id);

  const encodedData = encodeFunctionData({
    abi:
      function_name === "adminResolveRelease"
        ? [adminResolveReleaseFunctionAbi]
        : [adminResolveRefundFunctionAbi],
    args: [onchainDealId],
    functionName: function_name,
  });

  return sendTransaction(config, {
    chainId: contractCall.chain_id,
    data: withBuilderCodeSuffix(encodedData),
    to: getAddress(contract_address),
  });
}

// Wait for a transaction to be confirmed on chain.
export async function waitForTx(config: Config, hash: Hex): Promise<void> {
  const receipt = await waitForTransactionReceipt(config, { hash });

  if (receipt.status !== "success") {
    throw new TransactionRevertedError(hash);
  }
}
