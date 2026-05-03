import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  DealCompletionValidationError,
  parseDealCompletionRouteParams,
} from "@/lib/validators/deals-completion";
import {
  DealCompletionServiceError,
  prepareOpenDisputeForDeal,
} from "@/server/services/deals-completion";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser();
    const parsedParams = parseDealCompletionRouteParams(await params);
    const result = await prepareOpenDisputeForDeal(currentUser, parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealCompletionValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealCompletionServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
