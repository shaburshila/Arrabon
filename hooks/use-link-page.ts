"use client";

// Orchestrates data loading for /link/[id].
// Polls GET /api/links/:id after funding until deal_id appears.

import { useCallback, useEffect, useRef, useState } from "react";
import { getAddress } from "viem";

import { fetchLink, type PublicLink } from "@/lib/api/links";
import { ApiError } from "@/lib/api/auth";

export type LinkPageStatus =
  | "loading"
  | "ready"
  | "not_found"     // 404
  | "unavailable"   // 410 Expired | Cancelled
  | "error";

export type UnavailableReason = "Cancelled" | "Expired" | null;

export interface LinkPageState {
  link: PublicLink | null;
  role: "seller" | "viewer";
  status: LinkPageStatus;
  unavailableReason: UnavailableReason;
  error: string | null;
  refetch: () => Promise<void>;
  // Polling: call this after funding tx confirmed to start polling for deal_id
  startDealIdPolling: (onDealId: (dealId: string) => void) => void;
  stopPolling: () => void;
}

export function useLinkPage(linkId: string, walletAddress: string | null): LinkPageState {
  const [link, setLink] = useState<PublicLink | null>(null);
  const [status, setStatus] = useState<LinkPageStatus>("loading");
  const [unavailableReason, setUnavailableReason] = useState<UnavailableReason>(null);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchLink(linkId);
      setLink(data);
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
    (onDealId: (dealId: string) => void) => {
      stopPolling();
      let count = 0;
      const MAX_POLLS = 40;

      pollingRef.current = setInterval(async () => {
        count += 1;
        if (count > MAX_POLLS) {
          stopPolling();
          return;
        }
        try {
          const data = await fetchLink(linkId);
          setLink(data);
          if (data.deal_id) {
            stopPolling();
            onDealId(data.deal_id);
          }
        } catch {
          // silently ignore poll errors
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
