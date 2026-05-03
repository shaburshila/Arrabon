// USDC ERC-20 integration: allowance check and approve.
// Uses @wagmi/core imperative actions with the wagmi config.

import { readContract, writeContract, waitForTransactionReceipt } from "@wagmi/core";
import { getAddress, type Address, type Hex } from "viem";
import type { Config } from "wagmi";

import { baseRuntimeConfig } from "@/lib/base/config";

const ALLOWANCE_PROPAGATION_POLL_ATTEMPTS = 5;
const ALLOWANCE_PROPAGATION_POLL_INTERVAL_MS = 1_500;
const ALLOWANCE_PROPAGATION_TIMEOUT_MESSAGE =
  "USDC approval is confirmed, but the allowance update is taking too long. Please retry.";

const erc20AllowanceAbi = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const erc20ApproveAbi = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
] as const;

function getUsdcAddress(): Address {
  return getAddress(baseRuntimeConfig.usdcAddress);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// Check current USDC allowance for owner → spender
export async function getUsdcAllowance(
  config: Config,
  owner: Address,
  spender: Address,
): Promise<bigint> {
  return readContract(config, {
    abi: erc20AllowanceAbi,
    address: getUsdcAddress(),
    args: [owner, spender],
    functionName: "allowance",
  });
}

// Approve spender to spend amount of USDC from the connected wallet.
// Returns the tx hash.
export async function approveUsdc(
  config: Config,
  spender: Address,
  amount: bigint,
): Promise<Hex> {
  return writeContract(config, {
    abi: erc20ApproveAbi,
    address: getUsdcAddress(),
    args: [spender, amount],
    functionName: "approve",
  });
}

// Ensure the escrow contract has at least `amount` allowance from `owner`.
// If not, submits an approve tx and waits for receipt.
// onApproveStart: called when approve tx is about to be submitted (for UX state).
// onApprovePending: called with tx hash after submission.
export async function ensureUsdcAllowance(
  config: Config,
  owner: Address,
  spender: Address,
  amount: bigint,
  callbacks: {
    delay?: (ms: number) => Promise<void>;
    onApproveStart?: () => void;
    onApprovePending?: (hash: Hex) => void;
  } = {},
): Promise<void> {
  const current = await getUsdcAllowance(config, owner, spender);
  if (current >= amount) return;

  callbacks.onApproveStart?.();
  const hash = await approveUsdc(config, spender, amount);
  callbacks.onApprovePending?.(hash);
  await waitForTransactionReceipt(config, { hash });

  for (let attempt = 0; attempt < ALLOWANCE_PROPAGATION_POLL_ATTEMPTS; attempt += 1) {
    const updatedAllowance = await getUsdcAllowance(config, owner, spender);

    if (updatedAllowance >= amount) {
      return;
    }

    if (attempt < ALLOWANCE_PROPAGATION_POLL_ATTEMPTS - 1) {
      await (callbacks.delay ?? delay)(ALLOWANCE_PROPAGATION_POLL_INTERVAL_MS);
    }
  }

  throw new Error(ALLOWANCE_PROPAGATION_TIMEOUT_MESSAGE);
}
