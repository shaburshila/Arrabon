import { NextResponse } from "next/server";

import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
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

export async function GET() {
  try {
    await requireAdmin();
    const result = await listAdminDisputedDeals();

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealAdminServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
