import "server-only";

import { getAddress } from "viem";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { DealResolutionType, DealStatus } from "@/lib/db/types";
import type { ListPagination } from "@/lib/validators/pagination";
import {
  DealsRepositoryError,
  listBuyerDealRows,
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
): Promise<MyDealResult[]> {
  try {
    return await listBuyerDealRows(getAddress(currentUser.wallet_address), pagination);
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
