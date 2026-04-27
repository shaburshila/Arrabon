import "server-only";

import { isAddress } from "viem";
import { z } from "zod";

import type { WalletDenylistReason } from "@/lib/db/types";
import type { ValidationIssue } from "@/lib/validators/deals";

export class AdminDenylistValidationError extends Error {
  issues: ValidationIssue[];

  constructor(issues: ValidationIssue[]) {
    super("Invalid admin denylist input.");
    this.name = "AdminDenylistValidationError";
    this.issues = issues;
  }
}

export interface AddAdminDenylistBody {
  notes: string | null;
  reason: WalletDenylistReason;
  wallet: string;
}

export interface RemoveAdminDenylistBody {
  comment: string;
}

export interface AdminDenylistWalletRouteParams {
  wallet: string;
}

const walletSchema = z.string().trim().refine((value) => isAddress(value), {
  message: "Wallet must be a valid address.",
});

const addAdminDenylistBodySchema = z.object({
  notes: z.string().trim().min(1).max(500).nullable().optional(),
  reason: z.enum(["fraud", "abuse", "sanctions", "other"]),
  wallet: walletSchema,
});

const removeAdminDenylistBodySchema = z.object({
  comment: z.string().trim().min(1).max(500),
});

function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join(".") : "body",
    message: issue.message,
  }));
}

export function parseAddAdminDenylistBody(value: unknown): AddAdminDenylistBody {
  const result = addAdminDenylistBodySchema.safeParse(value);

  if (!result.success) {
    throw new AdminDenylistValidationError(formatZodIssues(result.error));
  }

  return {
    notes: result.data.notes ?? null,
    reason: result.data.reason,
    wallet: result.data.wallet,
  };
}

export function parseRemoveAdminDenylistBody(value: unknown): RemoveAdminDenylistBody {
  const result = removeAdminDenylistBodySchema.safeParse(value);

  if (!result.success) {
    throw new AdminDenylistValidationError(formatZodIssues(result.error));
  }

  return result.data;
}

export function parseAdminDenylistWalletRouteParams(
  params: { wallet?: string | undefined },
): AdminDenylistWalletRouteParams {
  const result = walletSchema.safeParse(params.wallet);

  if (!result.success) {
    throw new AdminDenylistValidationError([
      {
        field: "wallet",
        message: "Wallet must be a valid address.",
      },
    ]);
  }

  return {
    wallet: result.data,
  };
}
