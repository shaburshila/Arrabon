import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
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

export async function GET() {
  try {
    const currentUser = await requireUser();
    const deals = await listMyBuyerDeals(currentUser);

    return NextResponse.json(deals);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof MyDealsServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
