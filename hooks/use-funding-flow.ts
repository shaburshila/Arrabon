"use client";

// Orchestrates the full funding flow:
// backend prepare → USDC approve (if needed) → createAndFundDeal → poll for deal_id
// No calldata is built independently — all comes from the backend prepare endpoint.

import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { getAddress, type Address, type Hex } from "viem";

import { prepareFunding } from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";
import { ensureUsdcAllowance } from "@/lib/contract/usdc";
import { executeFundingCall, waitForTx } from "@/lib/contract/execute-prepared-call";

export type FundingStep =
  | "approve_pending"     // approve tx on chain
  | "approve_signature"   // waiting for approve wallet signature
  | "failed"
  | "fund_pending"        // fund tx on chain
  | "fund_signature"      // waiting for createAndFundDeal signature
  | "idle"
  | "indexing"            // waiting for backend to index the deal
  | "preparing"           // calling backend prepare
  | "succeeded";

export interface FundingState {
  error: string | null;
  step: FundingStep;
  txHash: Hex | null;
}

export interface FundingFlow {
  execute: () => Promise<void>;
  reset: () => void;
  state: FundingState;
}

export function useFundingFlow(
  linkId: string,
  onDealIndexed: (dealId: string) => void,
  startPolling: (onDealId: (dealId: string) => void) => void,
): FundingFlow {
  const config = useConfig();

  const [state, setState] = useState<FundingState>({
    error: null,
    step: "idle",
    txHash: null,
  });

  const set = useCallback((partial: Partial<FundingState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const execute = useCallback(async () => {
    if (state.step !== "idle" && state.step !== "failed") return;

    set({ error: null, step: "preparing", txHash: null });

    try {
      // 1. Backend prepare — source of truth for all contract args
      const prepared = await prepareFunding(linkId);
      const { contract_call } = prepared;
      const escrowAddress = getAddress(contract_call.contract_address) as Address;
      const price = BigInt(contract_call.args.price);
      // walletAddress from prepared response (backend derives from session)
      const buyerAddress = getAddress(prepared.buyer_address) as Address;

      // 2. USDC approval if needed
      await ensureUsdcAllowance(config, buyerAddress, escrowAddress, price, {
        onApproveStart: () => set({ step: "approve_signature" }),
        onApprovePending: (hash) => set({ step: "approve_pending", txHash: hash }),
      });

      // 3. createAndFundDeal
      set({ step: "fund_signature", txHash: null });
      const fundHash = await executeFundingCall(config, contract_call);
      set({ step: "fund_pending", txHash: fundHash });

      // 4. Wait for on-chain confirmation
      await waitForTx(config, fundHash);

      // 5. Poll backend until deal_id appears
      set({ step: "indexing" });
      startPolling((dealId) => {
        set({ step: "succeeded" });
        onDealIndexed(dealId);
      });
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Funding failed.";
      set({ error: message, step: "failed" });
    }
  }, [config, linkId, onDealIndexed, startPolling, state.step, set]);

  const reset = useCallback(() => {
    setState({ error: null, step: "idle", txHash: null });
  }, []);

  return { execute, reset, state };
}
