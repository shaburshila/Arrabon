import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  listMyBuyerDeals,
  MyDealsServiceError,
} from "@/server/services/my-deals";

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
    const currentUser = await requireUser();
    const pagination = parseListPagination(new URL(request.url).searchParams);
    const deals = await listMyBuyerDeals(currentUser, pagination);

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
