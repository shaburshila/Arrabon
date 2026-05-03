import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  DealValidationError,
  parseDealRouteParams,
} from "@/lib/validators/deals";
import {
  DisputeMessageValidationError,
  parseCreateDisputeMessageBody,
} from "@/lib/validators/dispute-messages";
import {
  createDisputeMessageForDeal,
  DisputeMessagesServiceError,
  listDisputeMessagesForDeal,
} from "@/server/services/dispute-messages";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const currentUser = await requireUser();
    const parsedParams = parseDealRouteParams(await params);
    const result = await listDisputeMessagesForDeal(currentUser, parsedParams);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DisputeMessagesServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}

export async function POST(
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
    const parsedParams = parseDealRouteParams(await params);
    const parsedBody = parseCreateDisputeMessageBody(payload);
    const result = await createDisputeMessageForDeal(
      currentUser,
      parsedParams,
      parsedBody,
    );

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof DealValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DisputeMessageValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof DisputeMessagesServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
