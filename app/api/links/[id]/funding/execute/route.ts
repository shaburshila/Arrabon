import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  FundingValidationError,
  parseFundingExecutionGrantBody,
  parsePrepareFundingParams,
} from "@/lib/validators/funding";
import {
  exchangeFundingGrantForLink,
  FundingServiceError,
} from "@/server/services/funding";

export const runtime = "nodejs";

function jsonFundingError(
  message: string,
  status: number,
  details?: unknown,
  statusValue?: "Cancelled" | "Consumed" | "Expired",
) {
  return Response.json(
    {
      ...(details !== undefined ? { details } : {}),
      error: message,
      ...(statusValue ? { status: statusValue } : {}),
    },
    { status },
  );
}

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
    const parsedParams = parsePrepareFundingParams(await params);
    const body = parseFundingExecutionGrantBody(payload);
    const result = await exchangeFundingGrantForLink(
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

    if (error instanceof FundingValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof FundingServiceError) {
      return jsonFundingError(error.message, error.status, undefined, error.statusValue);
    }

    return jsonError("Internal server error.", 500);
  }
});
