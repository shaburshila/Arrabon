"use client";

// Orchestrates deal lifecycle actions: complete, release, dispute.
// Pattern: backend prepare → execute wallet tx → wait for chain → refetch deal.
// One in-flight action at a time (duplicate calls blocked while active).

import { useCallback, useMemo, useRef, useState, type MutableRefObject } from "react";
import { useConfig } from "wagmi";
import { getAddress, type Address, type Hex } from "viem";

import {
  type DealReadModel,
  type DealStatus,
  prepareAutoRelease,
  prepareComplete,
  prepareDispute,
  prepareRelease,
} from "@/lib/api/deals";
import { triggerFundingSync } from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";
import { executeLifecycleCall, waitForTx } from "@/lib/contract/execute-prepared-call";

export type ActionStep =
  | "compliance_blocked"
  | "failed"
  | "idle"
  | "pending_chain"
  | "preparing"
  | "signature"
  | "sync_failed"
  | "syncing_backend"
  | "succeeded";

export interface ActionState {
  complianceReasonCode: string | null;
  complianceWallet: Address | null;
  error: string | null;
  step: ActionStep;
  txHash: Hex | null;
}

export interface DealAction {
  execute: () => Promise<void>;
  reset: () => void;
  state: ActionState;
}

interface ActionMutex {
  lockRef: MutableRefObject<boolean>;
  setIsAnyActionInFlight: (value: boolean) => void;
}

function getComplianceWalletAddress(body: unknown): Address | null {
  if (!body || typeof body !== "object" || !("wallet_address" in body)) {
    return null;
  }

  const walletAddress = (body as { wallet_address?: unknown }).wallet_address;

  if (typeof walletAddress !== "string") {
    return null;
  }

  try {
    return getAddress(walletAddress) as Address;
  } catch {
    return null;
  }
}

export function createInitialActionState(): ActionState {
  return {
    complianceReasonCode: null,
    complianceWallet: null,
    error: null,
    step: "idle",
    txHash: null,
  };
}

export function getActionErrorState(
  err: unknown,
): Pick<ActionState, "complianceReasonCode" | "complianceWallet" | "error" | "step"> {
  if (
    err instanceof ApiError &&
    err.status === 403 &&
    err.code === "COMPLIANCE_BLOCKED" &&
    err.reason_code !== "PROVIDER_UNAVAILABLE"
  ) {
    return {
      complianceReasonCode: err.reason_code ?? null,
      complianceWallet: getComplianceWalletAddress(err.body),
      error: null,
      step: "compliance_blocked",
    };
  }

  return {
    complianceReasonCode: null,
    complianceWallet: null,
    error:
      err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Action failed.",
    step: "failed",
  };
}

function useSingleAction(
  dealId: string,
  consultationLinkId: string,
  prepareFn: (id: string) => Promise<{ contract_call: import("@/lib/api/deals").LifecycleContractCall; deal_id: string }>,
  expectedStatus: DealStatus,
  onSuccess: () => Promise<DealReadModel | null>,
  mutex: ActionMutex,
): DealAction {
  const config = useConfig();

  const [state, setState] = useState<ActionState>(createInitialActionState);

  const set = useCallback((partial: Partial<ActionState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const wait = useCallback((ms: number) => {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }, []);

  const syncUntilConverged = useCallback(
    async (txHash: Hex): Promise<boolean> => {
      const MAX_ATTEMPTS = 40;
      const RETRY_INTERVAL_MS = 2_000;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const syncResult = consultationLinkId
          ? await triggerFundingSync(consultationLinkId).catch((error) => {
            console.warn("Lifecycle sync trigger failed after confirmed tx.", {
              attempt,
              dealId,
              error,
              txHash,
            });

            return {
              code: "LIFECYCLE_SYNC_TRIGGER_FAILED",
              error: "Backend sync is temporarily unavailable.",
              ok: false as const,
              status: "retryable" as const,
            };
          })
          : null;

        if (syncResult && !syncResult.ok && syncResult.status === "fatal") {
          set({
            error: "Transaction confirmed, but backend indexing is unavailable. Please do not retry the transaction; refresh later.",
            step: "sync_failed",
          });

          return false;
        }

        const latestDeal = await onSuccess();

        if (latestDeal?.status === expectedStatus) {
          return true;
        }

        if (attempt < MAX_ATTEMPTS) {
          await wait(RETRY_INTERVAL_MS);
        }
      }

      set({
        error: "Transaction confirmed, but backend sync is delayed. Please refresh this page in a moment.",
        step: "sync_failed",
      });

      return false;
    },
    [consultationLinkId, dealId, expectedStatus, onSuccess, set, wait],
  );

  const execute = useCallback(async () => {
    if (mutex.lockRef.current) {
      return;
    }

    if (
      state.step !== "idle" &&
      state.step !== "failed"
    ) {
      return;
    }

    mutex.lockRef.current = true;
    mutex.setIsAnyActionInFlight(true);
    set({
      complianceReasonCode: null,
      complianceWallet: null,
      error: null,
      step: "preparing",
      txHash: null,
    });

    try {
      const prepared = await prepareFn(dealId);
      set({ step: "signature" });

      const hash = await executeLifecycleCall(config, prepared.contract_call);
      set({ step: "pending_chain", txHash: hash });

      await waitForTx(config, hash);
      set({ step: "syncing_backend" });

      const converged = await syncUntilConverged(hash);

      if (!converged) {
        return;
      }

      set({
        complianceReasonCode: null,
        complianceWallet: null,
        error: null,
        step: "succeeded",
      });
    } catch (err) {
      set(getActionErrorState(err));
    } finally {
      mutex.lockRef.current = false;
      mutex.setIsAnyActionInFlight(false);
    }
  }, [config, dealId, mutex, prepareFn, state.step, syncUntilConverged, set]);

  const reset = useCallback(() => {
    setState(createInitialActionState());
  }, []);

  return { execute, reset, state };
}

// Returns separate action hooks for lifecycle calls.
// Each has independent state — only one should be in flight at a time per UI gating.
export function useDealActions(
  dealId: string,
  consultationLinkId: string,
  refetchDeal: () => Promise<DealReadModel | null>,
) {
  const actionLockRef = useRef(false);
  const [isAnyActionInFlight, setIsAnyActionInFlight] = useState(false);
  const mutex = useMemo<ActionMutex>(() => ({
    lockRef: actionLockRef,
    setIsAnyActionInFlight,
  }), []);

  const complete = useSingleAction(
    dealId,
    consultationLinkId,
    prepareComplete,
    "ConfirmPending",
    refetchDeal,
    mutex,
  );
  const release = useSingleAction(
    dealId,
    consultationLinkId,
    prepareRelease,
    "Released",
    refetchDeal,
    mutex,
  );
  const dispute = useSingleAction(
    dealId,
    consultationLinkId,
    prepareDispute,
    "Disputed",
    refetchDeal,
    mutex,
  );
  const autoRelease = useSingleAction(
    dealId,
    consultationLinkId,
    prepareAutoRelease,
    "Released",
    refetchDeal,
    mutex,
  );

  return { autoRelease, complete, dispute, isAnyActionInFlight, release };
}
