import "server-only";

import { createPublicClient, http } from "viem";

import { baseRuntimeConfig } from "@/lib/base/config";

export function getCompliancePublicClient() {
  return createPublicClient({
    chain: baseRuntimeConfig.chain,
    transport: http(baseRuntimeConfig.rpcUrl),
  });
}
