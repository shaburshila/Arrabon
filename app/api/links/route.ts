import { NextResponse } from "next/server";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  ConsultationLinkValidationError,
  parseCreateConsultationLinkInput,
} from "@/lib/validators/consultation-links";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  ConsultationLinkServiceError,
  createConsultationLink,
  listMyConsultationLinks,
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

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser();
    const pagination = parseListPagination(new URL(request.url).searchParams);
    const links = await listMyConsultationLinks(currentUser, new Date(), pagination);
    return NextResponse.json(links);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }
    if (error instanceof PaginationValidationError) {
      return jsonError(error.message, 400);
    }
    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status);
    }
    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return jsonError("Invalid JSON body.", 400);
  }

  try {
    const currentUser = await requireUser();
    const input = parseCreateConsultationLinkInput(payload);
    const result = await createConsultationLink(currentUser, input);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof ConsultationLinkValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof ConsultationLinkServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
