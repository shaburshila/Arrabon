import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireUser } from "@/lib/auth/guards";
import {
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";
import {
  ConsultationLinkValidationError,
  parseCreateConsultationLinkInput,
} from "@/lib/validators/consultation-links";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  type MyConsultationLinksFilter,
  ConsultationLinkServiceError,
  createConsultationLink,
  listMyConsultationLinks,
  listMyConsultationLinksWithCounts,
} from "@/server/services/consultation-links";

export const runtime = "nodejs";

const MY_LINK_FILTER_VALUES: ReadonlySet<MyConsultationLinksFilter> = new Set([
  "all",
  "available",
  "upcoming",
  "awaiting_buyer",
  "disputed",
  "closed",
  "inactive",
]);

function parseMyLinksFilter(searchParams: URLSearchParams): MyConsultationLinksFilter {
  const filter = searchParams.get("filter");

  if (filter === null) {
    return "all";
  }

  if (MY_LINK_FILTER_VALUES.has(filter as MyConsultationLinksFilter)) {
    return filter as MyConsultationLinksFilter;
  }

  throw new PaginationValidationError("filter must be a valid my-links filter.");
}

export async function GET(request: Request) {
  try {
    const currentUser = await requireUser();
    const searchParams = new URL(request.url).searchParams;
    const pagination = parseListPagination(searchParams);
    const filter = parseMyLinksFilter(searchParams);

    if (searchParams.get("include_counts") === "true") {
      const page = await listMyConsultationLinksWithCounts(
        currentUser,
        new Date(),
        pagination,
        filter,
      );
      return NextResponse.json(page);
    }

    const links = await listMyConsultationLinks(currentUser, new Date(), pagination, filter);
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

export const POST = withComplianceErrorHandling(async function POST(request: Request) {
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
    if (error instanceof ComplianceBlockedError) {
      throw error;
    }

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
});
