"use client";

// Orchestrates data loading for /link/[id].
// Polls GET /api/links/:id after funding until deal_id appears.

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress, type Hex } from "viem";

import {
  fetchLink,
  triggerFundingSync,
  type FundingSyncResult,
  type PublicLink,
} from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";

export type LinkPageStatus =
  | "loading"
  | "ready"
  | "not_found"     // 404
  | "unavailable"   // 410 Expired | Cancelled
  | "error";

export type UnavailableReason = "Cancelled" | "Expired" | null;

export interface LinkPageState {
  dealIdPollingTimedOut: boolean;
  link: PublicLink | null;
  role: "seller" | "viewer";
  status: LinkPageStatus;
  unavailableReason: UnavailableReason;
  error: string | null;
  refetch: () => Promise<void>;
  // Polling: call this after funding tx confirmed to start polling for deal_id
  startDealIdPolling: (
    onDealId: (dealId: string) => void,
    onTimeout?: () => void,
    onSyncStatus?: (result: FundingSyncResult) => void,
    txHash?: Hex,
  ) => void;
  stopPolling: () => void;
}

export function useLinkPage(linkId: string, walletAddress: string | null): LinkPageState {
  const [link, setLink] = useState<PublicLink | null>(null);
  const [status, setStatus] = useState<LinkPageStatus>("loading");
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason>(null);
  const [error, setError] = useState<string | null>(null);
  const [dealIdPollingTimedOut, setDealIdPollingTimedOut] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchLink(linkId);
      setLink(data);
      setDealIdPollingTimedOut(false);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 404) {
          setStatus("not_found");
        } else if (err.status === 410) {
          setStatus("unavailable");
          const body = err.body as { status?: string } | null;
          if (body?.status === "Expired" || body?.status === "Cancelled") {
            setUnavailableReason(body.status);
          }
        } else {
          setError(err.message);
          setStatus("error");
        }
      } else {
        setError("Failed to load link.");
        setStatus("error");
      }
    }
  }, [linkId]);

  useEffect(() => {
    load();
    return () => stopPolling();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkId]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current !== null) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  // Poll every 2s until deal_id is non-null, then call onDealId and stop.
  // Max 40 polls (~80s) to avoid infinite loop.
  const startDealIdPolling = useCallback(
    (
      onDealId: (dealId: string) => void,
      onTimeout?: () => void,
      onSyncStatus?: (result: FundingSyncResult) => void,
      txHash?: Hex,
    ) => {
      stopPolling();
      setDealIdPollingTimedOut(false);
      let count = 0;
      let syncConfirmed = false;
      const MAX_POLLS = 40;

      pollingRef.current = setInterval(async () => {
        count += 1;
        if (count > MAX_POLLS) {
          stopPolling();
          setDealIdPollingTimedOut(true);
          onTimeout?.();
          return;
        }
        if (!syncConfirmed) {
          try {
            const syncResult = await triggerFundingSync(linkId, txHash);
            onSyncStatus?.(syncResult);

            if (syncResult.ok) {
              syncConfirmed = true;
            }

            if (!syncResult.ok && syncResult.status === "fatal") {
              stopPolling();
              return;
            }
          } catch (err) {
            const errorMessage =
              err instanceof ApiError
                ? err.message
                : err instanceof Error
                  ? err.message
                  : "Backend indexing check failed.";
            onSyncStatus?.({
              code: "POLLING_SYNC_CHECK_FAILED",
              error: errorMessage,
              ok: false,
              status: "retryable",
            });
          }
        }

        try {
          const data = await fetchLink(linkId);
          setLink(data);
          if (data.deal_id) {
            stopPolling();
            setDealIdPollingTimedOut(false);
            onDealId(data.deal_id);
          }
        } catch (err) {
          const errorMessage =
            err instanceof ApiError
              ? err.message
              : err instanceof Error
                ? err.message
                : "Link read check failed.";
          onSyncStatus?.({
            code: "POLLING_LINK_FETCH_FAILED",
            error: errorMessage,
            ok: false,
            status: "retryable",
          });
        }
      }, 2000);
    },
    [linkId, stopPolling],
  );

  // Role: seller if wallet matches seller_address (normalized), else viewer
  const role: "seller" | "viewer" = (() => {
    if (!walletAddress || !link) return "viewer";
    try {
      return getAddress(walletAddress) === getAddress(link.seller_address)
        ? "seller"
        : "viewer";
    } catch {
      return "viewer";
    }
  })();

  return {
    dealIdPollingTimedOut,
    error,
    link,
    role,
    startDealIdPolling,
    status,
    unavailableReason,
    stopPolling,
    refetch: load,
  };
}
