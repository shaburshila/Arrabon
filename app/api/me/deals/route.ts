import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  type MyDealsFilter,
  listMyBuyerDeals,
  MyDealsServiceError,
} from "@/server/services/my-deals";

export const runtime = "nodejs";

const MY_DEALS_FILTER_VALUES: ReadonlySet<MyDealsFilter> = new Set([
  "all",
  "upcoming",
  "needs_action",
  "disputed",
  "resolved",
]);

function parseMyDealsFilter(searchParams: URLSearchParams): MyDealsFilter {
  const filter = searchParams.get("filter");

  if (filter === null) {
    return "all";
  }

  if (MY_DEALS_FILTER_VALUES.has(filter as MyDealsFilter)) {
    return filter as MyDealsFilter;
  }

  throw new PaginationValidationError("filter must be a valid my-deals filter.");
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const currentUser = await requireUser();
    const pagination = parseListPagination(searchParams);
    const filter = parseMyDealsFilter(searchParams);
    const deals = await listMyBuyerDeals(currentUser, pagination, filter);

    return NextResponse.json(deals);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof MyDealsServiceError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof PaginationValidationError) {
      return jsonError(error.message, 400);
    }

    return jsonError("Internal server error.", 500);
  }
}
