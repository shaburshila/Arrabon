// Executes backend-prepared contract calls via viem/wagmi.
// Frontend never builds calldata independently — it only executes the opaque payload from the backend.

import { getConnectorClient, waitForTransactionReceipt } from "@wagmi/core";
import { sendTransaction } from "viem/actions";
import { getAddress, type Address, type Hex } from "viem";
import type { Config } from "wagmi";

import { resolveBaseChain } from "@/lib/base/chains";
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

async function executePreparedTransaction(
  config: Config,
  chainId: number,
  data: Hex,
  to: Address,
): Promise<Hex> {
  const client = await getConnectorClient(config, {
    assertChainId: false,
    chainId,
  });

  return sendTransaction(client, {
    chain: resolveBaseChain(chainId),
    data,
    to,
  });
}

// Execute a backend-prepared createAndFundDeal call.
// Returns the tx hash immediately after submission.
export async function executeFundingCall(
  config: Config,
  contractCall: FundingContractCall,
): Promise<Hex> {
  return executePreparedTransaction(
    config,
    contractCall.chain_id,
    contractCall.data,
    getAddress(contractCall.contract_address),
  );
}

// Execute a backend-prepared lifecycle call.
export async function executeLifecycleCall(
  config: Config,
  contractCall: LifecycleContractCall,
): Promise<Hex> {
  return executePreparedTransaction(
    config,
    contractCall.chain_id,
    contractCall.data,
    getAddress(contractCall.contract_address),
  );
}

// Execute a backend-prepared admin dispute resolution call.
export async function executeAdminCall(
  config: Config,
  contractCall: AdminContractCall,
): Promise<Hex> {
  return executePreparedTransaction(
    config,
    contractCall.chain_id,
    contractCall.data,
    getAddress(contractCall.contract_address),
  );
}

// Wait for a transaction to be confirmed on chain.
export async function waitForTx(config: Config, hash: Hex): Promise<void> {
  const receipt = await waitForTransactionReceipt(config, { hash });

  if (receipt.status !== "success") {
    throw new TransactionRevertedError(hash);
  }
}
