import { NextResponse } from "next/server";

import { AuthGuardError, requireUser } from "@/lib/auth/guards";
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
  const { id } = await params;

  try {
    const currentUser = await requireUser();
    const result = await cancelConsultationLink(currentUser, id);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
