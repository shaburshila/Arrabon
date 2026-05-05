import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  DealCompletionValidationError,
  parseDealCompletionRouteParams,
} from "@/lib/validators/deals-completion";
import {
  parsePayoutExecutionGrantBody,
  PayoutExecutionGrantValidationError,
} from "@/lib/validators/payout-execution-grants";
import {
  DealCompletionServiceError,
  exchangeConfirmReleaseGrantForDeal,
} from "@/server/services/deals-completion";

export const runtime = "nodejs";

export const POST = withComplianceErrorHandling(async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  try {
    const currentUser = await requireUser();
    const parsedParams = parseDealCompletionRouteParams(await params);
    const body = parsePayoutExecutionGrantBody(payload);
    const result = await exchangeConfirmReleaseGrantForDeal(
      currentUser,
      parsedParams,
      body.grant_token,
    );

    return Response.json(result);
  } catch (error) {
    if (error instanceof ComplianceBlockedError) {
      throw error;
    }

    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealCompletionValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof PayoutExecutionGrantValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealCompletionServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
});
