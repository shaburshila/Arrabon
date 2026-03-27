import { NextResponse } from "next/server";
import {
  ConsultationLinkServiceError,
  getPublicConsultationLinkById,
} from "@/server/services/consultation-links";

export const runtime = "nodejs";

function jsonError(
  message: string,
  status: number,
  statusValue?: "Cancelled" | "Consumed" | "Expired" | "unavailable",
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
  const { id } = await params;

  try {
    const result = await getPublicConsultationLinkById(id);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status, error.statusValue);
    }

    return jsonError("Internal server error.", 500);
  }
}
