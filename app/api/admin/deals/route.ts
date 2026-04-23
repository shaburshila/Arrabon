import { NextResponse } from "next/server";

import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  DealAdminServiceError,
  listAdminDisputedDeals,
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

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const pagination = parseListPagination(new URL(request.url).searchParams);
    const result = await listAdminDisputedDeals(pagination);

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
