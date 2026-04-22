import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  FundingValidationError,
  parseLinkRouteParams,
} from "@/lib/validators/funding";
import {
  ConsultationLinkServiceError,
  cancelConsultationLink,
} from "@/server/services/consultation-links";

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
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser();
    const parsedParams = parseLinkRouteParams(await params);
    const result = await cancelConsultationLink(currentUser, parsedParams.linkId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof FundingValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
