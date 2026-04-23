import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  DealValidationError,
  parseDealRouteParams,
} from "@/lib/validators/deals";
import {
  DealReadServiceError,
  getDealReadModel,
} from "@/server/services/deals-read";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  details?: unknown,
) {
  const body: {
    details?: unknown;
    error: string;
  } = {
    error: message,
  };

  if (details !== undefined) {
    body.details = details;
  }

  return NextResponse.json(
    body,
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser();
    const parsedParams = parseDealRouteParams(await params);
    const result = await getDealReadModel(currentUser, parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DealReadServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
