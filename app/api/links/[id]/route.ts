import { NextResponse } from "next/server";
import {
  FundingValidationError,
  parseLinkRouteParams,
} from "@/lib/validators/funding";
import {
  ConsultationLinkServiceError,
  getPublicConsultationLinkById,
} from "@/server/services/consultation-links";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  statusValue?: "Cancelled" | "Expired" | "unavailable",
) {
  return NextResponse.json(
    {
      error: message,
      status: statusValue,
    },
    { status },
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const parsedParams = parseLinkRouteParams(await params);
    const result = await getPublicConsultationLinkById(parsedParams.linkId);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof FundingValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status, error.statusValue);
    }

    return jsonError("Internal server error.", 500);
  }
}
