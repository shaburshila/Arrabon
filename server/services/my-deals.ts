import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { DealResolutionType, DealStatus } from "@/lib/db/types";
import {
  normalizeListPagination,
  type ListPagination,
} from "@/lib/validators/pagination";
import {
  DealsRepositoryError,
  getAllBuyerDealRows,
} from "@/server/repositories/deals";

export interface MyDealResult {
  buyer_address: string;
  completed_at: string | null;
  consultation_link_id: string;
  created_at: string;
  description: string;
  duration_minutes: number;
  id: string;
  onchain_deal_id: string;
  price_usdc: string;
  released_at: string | null;
  resolution_type: DealResolutionType | null;
  resolved_at: string | null;
  resolved_from_status: DealStatus | null;
  scheduled_at: string;
  seller_address: string;
  status: DealStatus;
  timezone: string;
  title: string;
  tx_hash: string | null;
}

export type MyDealsFilter =
  | "all"
  | "upcoming"
  | "needs_action"
  | "disputed"
  | "resolved";

function matchMyDealFilter(deal: MyDealResult, filter: MyDealsFilter): boolean {
  if (filter === "all") return true;
  if (filter === "upcoming") return deal.status === "Funded";
  if (filter === "needs_action") return deal.status === "ConfirmPending";
  if (filter === "disputed") return deal.status === "Disputed";
  if (filter === "resolved") {
    return deal.status === "Released" || deal.status === "Refunded";
  }

  return false;
}

export class MyDealsServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "MyDealsServiceError";
    this.code = code;
    this.status = status;
  }
}

export async function listMyBuyerDeals(
  currentUser: CurrentUserContext,
  pagination?: Partial<ListPagination>,
  filter: MyDealsFilter = "all",
): Promise<MyDealResult[]> {
  try {
    const rows = await getAllBuyerDealRows(getAddress(currentUser.wallet_address));
    const filteredRows = rows.filter((deal) => matchMyDealFilter(deal, filter));
    const { limit, offset } = normalizeListPagination(pagination);

    return filteredRows.slice(offset, offset + limit);
  } catch (error) {
    if (error instanceof DealsRepositoryError) {
      if (error.code === "CONSULTATION_LINK_MISSING") {
        throw new MyDealsServiceError(
          "Failed to load deal consultation link.",
          500,
          "CONSULTATION_LINK_MISSING",
        );
      }

      throw new MyDealsServiceError(
        "Failed to load deals.",
        500,
        error.code ?? "DEALS_LOAD_FAILED",
      );
    }

    throw error;
  }
}
