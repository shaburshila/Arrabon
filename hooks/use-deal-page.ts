"use client";

// Orchestrates data loading for /deal/[id].
// Derives role from normalized wallet address comparison.

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";

import {
  fetchDeal,
  isDealStatusPollable,
  type DealReadModel,
} from "@/lib/api/deals";
import { ApiError } from "@/lib/api/auth";

const DEAL_PAGE_POLL_INTERVAL_MS = 7_500;

export type DealPageStatus = "error" | "loading" | "not_found" | "ready";

export type DealRole = "buyer" | "seller" | "viewer";

export interface DealPageState {
  deal: DealReadModel | null;
  error: string | null;
  isBuyer: boolean;
  isParticipant: boolean;
  isSeller: boolean;
  role: DealRole;
  status: DealPageStatus;
  refetch: () => Promise<DealReadModel | null>;
}

export function useDealPage(dealId: string, walletAddress: string | null): DealPageState {
  const [deal, setDeal] = useState<DealReadModel | null>(null);
  const [status, setStatus] = useState<DealPageStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [isPageVisible, setIsPageVisible] = useState(
    () => typeof document === "undefined" || document.visibilityState === "visible",
  );

  const load = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!silent) {
      setStatus("loading");
    }

    setError(null);
    try {
      const data = await fetchDeal(dealId);
      setDeal(data);
      setStatus("ready");

      return data;
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setDeal(null);
        setStatus("not_found");
        return null;
      }

      if (!silent) {
        setError(err instanceof Error ? err.message : "Failed to load deal.");
        setStatus("error");
      }

      return null;
    }
  }, [dealId]);

  const refetch = useCallback(() => load({ silent: true }), [load]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!deal || !isDealStatusPollable(deal.status)) {
      return undefined;
    }

    if (!isPageVisible) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void refetch();
    }, DEAL_PAGE_POLL_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [deal?.status, isPageVisible, refetch]);

  useEffect(() => {
    function handleVisibilityChange() {
      const isVisible = document.visibilityState === "visible";
      setIsPageVisible(isVisible);

      if (isVisible && deal && isDealStatusPollable(deal.status)) {
        void refetch();
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [deal?.status, refetch]);

  // Role inference — normalized address comparison only (raw string equality forbidden)
  const role: DealRole = (() => {
    if (!walletAddress || !deal) return "viewer";
    try {
      const norm = getAddress(walletAddress);
      if (norm === getAddress(deal.seller_address)) return "seller";
      if (norm === getAddress(deal.buyer_address)) return "buyer";
    } catch {
      // invalid address → viewer
    }
    return "viewer";
  })();

  const isSeller = role === "seller";
  const isBuyer = role === "buyer";
  const isParticipant = isSeller || isBuyer;

  return {
    deal,
    error,
    isBuyer,
    isParticipant,
    isSeller,
    role,
    status,
    refetch,
  };
}
