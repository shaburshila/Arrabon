"use client";

// Orchestrates the full funding flow:
// backend prepare → USDC approve (if needed) → createAndFundDeal → poll for deal_id
// No calldata is built independently — all comes from the backend prepare endpoint.

import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import { getAddress, type Address, type Hex } from "viem";

import {
  prepareFunding,
  triggerFundingSync,
  type FundingSyncResult,
} from "@/lib/api/links";
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
  | "indexing_failed"     // tx confirmed, backend indexing did not converge
  | "preparing"           // calling backend prepare
  | "succeeded";

export interface FundingState {
  error: string | null;
  step: FundingStep;
  txHash: Hex | null;
}

export interface FundingFlow {
  execute: () => Promise<void>;
  handlePollingTimeout: () => void;
  handleSyncStatus: (result: FundingSyncResult) => boolean;
  reset: () => void;
  retryIndexing: () => void;
  state: FundingState;
}

export function useFundingFlow(
  linkId: string,
  onDealIndexed: (dealId: string) => void,
  startPolling: (
    onDealId: (dealId: string) => void,
    onTimeout?: () => void,
    onSyncStatus?: (result: FundingSyncResult) => void,
    txHash?: Hex,
  ) => void,
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

  const handlePollingTimeout = useCallback(() => {
    set({
      error: "Your payment is confirmed onchain, but we couldn't index the deal yet. Please retry the check or refresh this page.",
      step: "indexing_failed",
    });
  }, [set]);

  const handleSyncStatus = useCallback((result: FundingSyncResult): boolean => {
    if (result.ok) {
      set({ error: null, step: "indexing" });

      return true;
    }

    if (result.status === "retryable") {
      set({
        error: "Your payment is confirmed onchain. Deal indexing is delayed, so we'll keep checking.",
        step: "indexing",
      });

      return true;
    }

    set({
      error: "Your payment is confirmed onchain, but backend indexing is currently unavailable. Please do not retry payment; retry the check or refresh later.",
      step: "indexing_failed",
    });

    return false;
  }, [set]);

  const runSyncTrigger = useCallback(async (txHash?: Hex): Promise<boolean> => {
    try {
      const result = await triggerFundingSync(linkId, txHash);

      return handleSyncStatus(result);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Backend indexing check failed.";

      return handleSyncStatus({
        code: "SYNC_TRIGGER_REQUEST_FAILED",
        error: message,
        ok: false,
        status: "retryable",
      });
    }
  }, [handleSyncStatus, linkId]);

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

      // 5. Trigger sync once immediately, then poll + re-trigger until deal_id appears
      set({ step: "indexing" });
      const canContinueIndexing = await runSyncTrigger(fundHash);

      if (!canContinueIndexing) {
        return;
      }

      startPolling((dealId) => {
        set({ error: null, step: "succeeded" });
        setTimeout(() => onDealIndexed(dealId), 500);
      }, handlePollingTimeout, handleSyncStatus, fundHash);
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Funding failed.";
      set({ error: message, step: "failed" });
    }
  }, [
    config,
    handlePollingTimeout,
    handleSyncStatus,
    linkId,
    onDealIndexed,
    runSyncTrigger,
    startPolling,
    state.step,
    set,
  ]);

  const reset = useCallback(() => {
    setState({ error: null, step: "idle", txHash: null });
  }, []);

  const retryIndexing = useCallback(() => {
    set({ error: null, step: "indexing" });
  }, [set]);

  return { execute, handlePollingTimeout, handleSyncStatus, reset, retryIndexing, state };
}
