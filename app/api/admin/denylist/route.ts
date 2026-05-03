import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  AdminDenylistValidationError,
  parseAddAdminDenylistBody,
} from "@/lib/validators/admin-denylist";
import {
  PaginationValidationError,
  parseListPagination,
} from "@/lib/validators/pagination";
import {
  addAdminDenylistEntry,
  AdminDenylistServiceError,
  listAdminDenylist,
} from "@/server/services/admin-denylist";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    await requireAdmin();
    const pagination = parseListPagination(new URL(request.url).searchParams);
    const result = await listAdminDenylist(pagination);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof PaginationValidationError) {
      return jsonError(error.message, 400);
    }

    if (error instanceof AdminDenylistServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}

export async function POST(request: Request) {
  try {
    const adminUser = await requireAdmin();
    const body = parseAddAdminDenylistBody(await request.json().catch(() => null));
    const result = await addAdminDenylistEntry(adminUser, body);

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AuthGuardError) {
      return jsonError(error.message, error.status);
    }

    if (error instanceof AdminDenylistValidationError) {
      return jsonError(error.message, 400, error.issues);
    }

    if (error instanceof AdminDenylistServiceError) {
      return jsonError(error.message, error.status);
    }

    return jsonError("Internal server error.", 500);
  }
}
