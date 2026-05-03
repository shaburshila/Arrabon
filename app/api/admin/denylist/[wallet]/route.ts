import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api/response";
import { AuthGuardError, requireAdmin } from "@/lib/auth/guards";
import {
  AdminDenylistValidationError,
  parseAdminDenylistWalletRouteParams,
  parseRemoveAdminDenylistBody,
} from "@/lib/validators/admin-denylist";
import {
  AdminDenylistServiceError,
  removeAdminDenylistEntry,
} from "@/server/services/admin-denylist";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  try {
    const adminUser = await requireAdmin();
    const parsedParams = parseAdminDenylistWalletRouteParams(await params);
    const body = parseRemoveAdminDenylistBody(await request.json().catch(() => null));
    const result = await removeAdminDenylistEntry(adminUser, parsedParams.wallet, body);

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
