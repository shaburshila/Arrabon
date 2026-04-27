import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  FundingValidationError,
  parsePrepareFundingParams,
} from "@/lib/validators/funding";
import {
  FundingServiceError,
  prepareFundingForLink,
} from "@/server/services/funding";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  details?: unknown,
  statusValue?: "Cancelled" | "Consumed" | "Expired",
) {
  return NextResponse.json(
    {
      details,
      error: message,
      status: statusValue,
    },
    { status },
  );
}

export const POST = withComplianceErrorHandling(async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser();
    const parsedParams = parsePrepareFundingParams(await params);
    const result = await prepareFundingForLink(currentUser, parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ComplianceBlockedError) {
      throw error;
    }

    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof FundingValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof FundingServiceError) {
      return jsonError(error.message, error.status, undefined, error.statusValue);
    }

    return jsonError("Internal server error.", 500);
  }
});
