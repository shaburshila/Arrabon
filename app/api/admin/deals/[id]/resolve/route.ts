import { NextResponse } from "next/server";

import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  DealValidationError,
  parseDealRouteParams,
} from "@/lib/validators/deals";
import {
  DealAdminValidationError,
  parseAdminResolveBody,
} from "@/lib/validators/deals-admin";
import {
  DealAdminServiceError,
  prepareAdminResolveForDeal,
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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
    const parsedParams = parseDealRouteParams(await params);
    const body = parseAdminResolveBody(await request.json().catch(() => null));
    const result = await prepareAdminResolveForDeal(
      parsedParams,
      body.resolution,
    );

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealAdminValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealAdminServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
