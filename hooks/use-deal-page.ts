"use client";

// Orchestrates data loading for /deal/[id].
// Derives role from normalized wallet address comparison.

import { useCallback, useEffect, useState } from "react";
import { getAddress } from "viem";

import { fetchDeal, type DealReadModel } from "@/lib/api/deals";
import { ApiError } from "@/lib/api/auth";

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
  refetch: () => Promise<void>;
}

export function useDealPage(dealId: string, walletAddress: string | null): DealPageState {
  const [deal, setDeal] = useState<DealReadModel | null>(null);
  const [status, setStatus] = useState<DealPageStatus>("loading");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus("loading");
    setError(null);
    try {
      const data = await fetchDeal(dealId);
      setDeal(data);
      setStatus("ready");
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setStatus("not_found");
      } else {
        setError(err instanceof Error ? err.message : "Failed to load deal.");
        setStatus("error");
      }
    }
  }, [dealId]);

  useEffect(() => {
    load();
  }, [load]);

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
    refetch: load,
  };
}
