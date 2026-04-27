import "server-only";

import type { CurrentUserContext } from "@/lib/auth/guards";
import type { WalletDenylistReason, WalletDenylistRow } from "@/lib/db/types";
import type {
  AddAdminDenylistBody,
  RemoveAdminDenylistBody,
} from "@/lib/validators/admin-denylist";
import type { ListPagination } from "@/lib/validators/pagination";
import {
  AuditLogRepositoryError,
  createAuditLogEntry,
} from "@/server/repositories/audit-log";
import {
  add,
  findByWallet,
  list,
  remove,
  WalletDenylistRepositoryError,
} from "@/server/repositories/wallet-denylist";

export interface AdminDenylistEntryModel {
  added_at: string;
  added_by_wallet: string;
  notes: string | null;
  reason: WalletDenylistReason;
  wallet: string;
}

export class AdminDenylistServiceError extends Error {
  code: string;
  status: number;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = "AdminDenylistServiceError";
    this.code = code;
    this.status = status;
  }
}

function toEntryModel(row: WalletDenylistRow): AdminDenylistEntryModel {
  return {
    added_at: row.added_at,
    added_by_wallet: row.added_by_wallet,
    notes: row.notes,
    reason: row.reason,
    wallet: row.wallet,
  };
}

function mapRepositoryError(error: unknown): never {
  if (error instanceof WalletDenylistRepositoryError) {
    throw new AdminDenylistServiceError(
      "Failed to load denylist entry.",
      500,
      error.code ?? "DENYLIST_REPOSITORY_ERROR",
    );
  }

  if (error instanceof AuditLogRepositoryError) {
    throw new AdminDenylistServiceError(
      "Failed to write audit log.",
      500,
      error.code ?? "AUDIT_LOG_WRITE_FAILED",
    );
  }

  throw error;
}

export async function listAdminDenylist(
  pagination?: Partial<ListPagination>,
): Promise<AdminDenylistEntryModel[]> {
  try {
    const rows = await list(pagination);
    return rows.map(toEntryModel);
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function addAdminDenylistEntry(
  currentUser: CurrentUserContext,
  body: AddAdminDenylistBody,
): Promise<AdminDenylistEntryModel> {
  try {
    const existingEntry = await findByWallet(body.wallet);

    if (existingEntry) {
      throw new AdminDenylistServiceError(
        "Wallet is already denylisted.",
        409,
        "DENYLIST_ENTRY_EXISTS",
      );
    }

    const row = await add({
      addedByWallet: currentUser.wallet_address,
      notes: body.notes,
      reason: body.reason,
      wallet: body.wallet,
    });

    await createAuditLogEntry({
      action: "admin_denylist_added",
      actorAddress: currentUser.wallet_address,
      entityId: row.wallet,
      entityType: "wallet_denylist",
      metadata: {
        notes: row.notes,
        reason: row.reason,
        wallet: row.wallet,
      },
    });

    return toEntryModel(row);
  } catch (error) {
    mapRepositoryError(error);
  }
}

export async function removeAdminDenylistEntry(
  currentUser: CurrentUserContext,
  wallet: string,
  body: RemoveAdminDenylistBody,
): Promise<{ removed_wallet: string }> {
  try {
    const existingEntry = await findByWallet(wallet);

    if (!existingEntry) {
      throw new AdminDenylistServiceError(
        "Denylist entry not found.",
        404,
        "DENYLIST_ENTRY_NOT_FOUND",
      );
    }

    await remove(wallet);
    await createAuditLogEntry({
      action: "admin_denylist_removed",
      actorAddress: currentUser.wallet_address,
      entityId: existingEntry.wallet,
      entityType: "wallet_denylist",
      metadata: {
        comment: body.comment,
        notes: existingEntry.notes,
        reason: existingEntry.reason,
        wallet: existingEntry.wallet,
      },
    });

    return {
      removed_wallet: existingEntry.wallet,
    };
  } catch (error) {
    mapRepositoryError(error);
  }
}
