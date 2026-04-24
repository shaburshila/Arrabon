import { NextResponse } from "next/server";

import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  DealAdminServiceError,
  listAdminDisputedDeals,
  listAdminResolvedDeals,
} from "@/server/services/deals-admin";

export const runtime = "nodejs";

function jsonError(message: string, status: number, details?: unknown) {
  return NextResponse.json(
    {
      details,
      error: message,
    },
    { status },
  );
}

function parseAdminDealsView(searchParams: URLSearchParams): "open" | "resolved" {
  const value = searchParams.get("view");

  if (value === null || value === "open") {
    return "open";
  }

  if (value === "resolved") {
    return "resolved";
  }

  throw new PaginationValidationError("view must be either 'open' or 'resolved'.");
}

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const searchParams = new URL(request.url).searchParams;
    const pagination = parseListPagination(searchParams);
    const view = parseAdminDealsView(searchParams);
    const result =
      view === "resolved"
        ? await listAdminResolvedDeals(pagination)
        : await listAdminDisputedDeals(pagination);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealAdminServiceError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof PaginationValidationError) {
      return jsonError(error.message, 400);
    }

    return jsonError("Internal server error.", 500);
  }
}
