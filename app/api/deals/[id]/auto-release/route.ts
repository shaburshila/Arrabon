import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  DealCompletionValidationError,
  parseDealCompletionRouteParams,
} from "@/lib/validators/deals-completion";
import {
  DealCompletionServiceError,
  prepareAutoReleaseForDeal,
} from "@/server/services/deals-completion";

export const runtime = "nodejs";

export const POST = withComplianceErrorHandling(async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsedParams = parseDealCompletionRouteParams(await params);
    const result = await prepareAutoReleaseForDeal(parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ComplianceBlockedError) {
      throw error;
    }

    if (error instanceof DealCompletionValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealCompletionServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
});
