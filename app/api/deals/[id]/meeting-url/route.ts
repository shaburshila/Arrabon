import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  DealValidationError,
  parseDealRouteParams,
} from "@/lib/validators/deals";
import { createAuditLogEntry } from "@/server/repositories/audit-log";
import {
  DealReadServiceError,
  revealMeetingUrlForDeal,
} from "@/server/services/deals-read";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  details?: unknown,
) {
  return NextResponse.json(
    {
      details,
      error: message,
    },
    { status },
  );
}

async function logUnauthenticatedRevealAttempt(dealId: string) {
  try {
    await createAuditLogEntry({
      action: "meeting_url_reveal_attempt",
      actorAddress: null,
      entityId: dealId,
      entityType: "deal",
      metadata: {
        code: "AUTH_REQUIRED",
        deal_id: dealId,
        outcome: "unauthenticated",
        request_path: `/api/deals/${dealId}/meeting-url`,
      },
    });
  } catch {
    throw new DealReadServiceError(
      "Internal server error.",
      500,
      "AUDIT_LOG_WRITE_FAILED",
    );
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const resolvedParams = await params;

  try {
    const parsedParams = parseDealRouteParams(resolvedParams);
    const currentUser = await requireUser();
    const result = await revealMeetingUrlForDeal(currentUser, parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof AuthGuardError) {
      if (typeof resolvedParams.id === "string" && resolvedParams.id.trim().length > 0) {
        try {
          await logUnauthenticatedRevealAttempt(resolvedParams.id);
        } catch (loggingError) {
          if (loggingError instanceof DealReadServiceError) {
            return jsonError(loggingError.message, loggingError.status);
          }

          return jsonError("Internal server error.", 500);
        }
      }

      return jsonError(error.message, error.status);
    }

    if (error instanceof DealReadServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
