"use client";

// Orchestrates deal lifecycle actions: complete, release, dispute.
// Pattern: backend prepare → execute wallet tx → wait for chain → refetch deal.
// One in-flight action at a time (duplicate calls blocked while active).

import { useCallback, useState } from "react";
import { useConfig } from "wagmi";
import type { Hex } from "viem";

import {
  prepareComplete,
  prepareDispute,
  prepareRelease,
} from "@/lib/api/deals";
import { triggerFundingSync } from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";
import { executeLifecycleCall, waitForTx } from "@/lib/contract/execute-prepared-call";

export type ActionStep =
  | "failed"
  | "idle"
  | "pending_chain"
  | "preparing"
  | "signature"
  | "succeeded";

export interface ActionState {
  error: string | null;
  step: ActionStep;
  txHash: Hex | null;
}

export interface DealAction {
  execute: () => Promise<void>;
  reset: () => void;
  state: ActionState;
}

function useSingleAction(
  dealId: string,
  consultationLinkId: string,
  prepareFn: (id: string) => Promise<{ contract_call: import("@/lib/api/deals").LifecycleContractCall; deal_id: string }>,
  onSuccess: () => Promise<void>,
): DealAction {
  const config = useConfig();

  const [state, setState] = useState<ActionState>({
    error: null,
    step: "idle",
    txHash: null,
  });

  const set = useCallback((partial: Partial<ActionState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const execute = useCallback(async () => {
    if (state.step !== "idle" && state.step !== "failed") return;

    set({ error: null, step: "preparing", txHash: null });

    try {
      const prepared = await prepareFn(dealId);
      set({ step: "signature" });

      const hash = await executeLifecycleCall(config, prepared.contract_call);
      set({ step: "pending_chain", txHash: hash });

      await waitForTx(config, hash);
      set({ step: "succeeded" });

      if (consultationLinkId) {
        await triggerFundingSync(consultationLinkId, hash).catch((error) => {
          console.warn("Lifecycle sync trigger failed after confirmed tx.", {
            dealId,
            error,
            txHash: hash,
          });
        });
      }

      // Refetch deal state from backend — no optimistic mutation
      await onSuccess();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Action failed.";
      set({ error: message, step: "failed" });
    }
  }, [config, consultationLinkId, dealId, onSuccess, prepareFn, state.step, set]);

  const reset = useCallback(() => {
    setState({ error: null, step: "idle", txHash: null });
  }, []);

  return { execute, reset, state };
}

// Returns three separate action hooks for complete, release, dispute.
// Each has independent state — only one should be in flight at a time per UI gating.
export function useDealActions(
  dealId: string,
  consultationLinkId: string,
  refetchDeal: () => Promise<void>,
) {
  const complete = useSingleAction(dealId, consultationLinkId, prepareComplete, refetchDeal);
  const release = useSingleAction(dealId, consultationLinkId, prepareRelease, refetchDeal);
  const dispute = useSingleAction(dealId, consultationLinkId, prepareDispute, refetchDeal);

  return { complete, dispute, release };
}
