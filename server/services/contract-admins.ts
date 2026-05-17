import "server-only";

import { createPublicClient, getAddress, http, type Address } from "viem";
import { readContract } from "viem/actions";

import { getConsultEscrowContractAddress } from "@/lib/base/consult-escrow";
import { adminsFunctionAbi } from "@/lib/base/consult-escrow-abi";
import { baseRuntimeConfig } from "@/lib/base/config";

export interface ContractAdminCheckStatus {
  isAdmin: boolean;
  source: "ok" | "rpc_error";
}

function getPublicClient() {
  return createPublicClient({
    chain: baseRuntimeConfig.chain,
    transport: http(baseRuntimeConfig.rpcUrl),
  });
}

export async function getContractAdminCheckStatus(
  wallet: string,
): Promise<ContractAdminCheckStatus> {
  try {
    const isAdmin = await readContract(getPublicClient(), {
      address: getConsultEscrowContractAddress(),
      abi: [adminsFunctionAbi],
      functionName: "admins",
      args: [getAddress(wallet) as Address],
    });

    return {
      isAdmin,
      source: "ok",
    };
  } catch (_error) {
    return {
      isAdmin: false,
      source: "rpc_error",
    };
  }
}

export async function isContractAdmin(wallet: string): Promise<boolean> {
  const status = await getContractAdminCheckStatus(wallet);
  return status.source === "ok" && status.isAdmin;
}
