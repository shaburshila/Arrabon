import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  DealValidationError,
  parseDealRouteParams,
} from "@/lib/validators/deals";
import {
  PayoutExecutionGrantValidationError,
  parsePayoutExecutionGrantBody,
} from "@/lib/validators/payout-execution-grants";
import {
  DealAdminServiceError,
  exchangeAdminResolveGrantForDeal,
} from "@/server/services/deals-admin";

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
    const adminUser = await requireAdmin();
    const parsedParams = parseDealRouteParams(await params);
    const body = parsePayoutExecutionGrantBody(payload);
    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
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

    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof PayoutExecutionGrantValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealAdminServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
});
