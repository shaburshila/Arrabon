import "server-only";

import type {
  WalletDenylistInsert,
  WalletDenylistReason,
  WalletDenylistRow,
} from "@/lib/db/types";
import { getServerDbClient } from "@/lib/db/server";
import {
  normalizeListPagination,
  type ListPagination,
} from "@/lib/validators/pagination";

export class WalletDenylistRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WalletDenylistRepositoryError";
    this.code = code;
  }
}

function normalizeWallet(wallet: string): string {
  return wallet.trim().toLowerCase();
}

export async function findByWallet(wallet: string): Promise<WalletDenylistRow | null> {
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("wallet_denylist")
    .select("*")
    .eq("wallet", normalizeWallet(wallet))
    .maybeSingle();

  if (error) {
    throw new WalletDenylistRepositoryError(
      `Failed to load denylist entry: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function existsByWallet(wallet: string): Promise<boolean> {
  return (await findByWallet(wallet)) !== null;
}

export interface AddWalletDenylistEntryInput {
  addedByWallet: string;
  notes?: string | null;
  reason: WalletDenylistReason;
  wallet: string;
}

export async function add(
  input: AddWalletDenylistEntryInput,
): Promise<WalletDenylistRow> {
  const db = getServerDbClient().schema("public");
  const payload: WalletDenylistInsert = {
    added_by_wallet: normalizeWallet(input.addedByWallet),
    notes: input.notes ?? null,
    reason: input.reason,
    wallet: normalizeWallet(input.wallet),
  };

  const { data, error } = await db
    .from("wallet_denylist")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new WalletDenylistRepositoryError(
      `Failed to create denylist entry: ${error.message}`,
      error.code,
    );
  }

  return data;
}

export async function remove(wallet: string): Promise<void> {
  const db = getServerDbClient().schema("public");
  const { error } = await db
    .from("wallet_denylist")
    .delete()
    .eq("wallet", normalizeWallet(wallet));

  if (error) {
    throw new WalletDenylistRepositoryError(
      `Failed to delete denylist entry: ${error.message}`,
      error.code,
    );
  }
}

export async function list(
  pagination?: Partial<ListPagination>,
): Promise<WalletDenylistRow[]> {
  const { limit, offset } = normalizeListPagination(pagination);
  const db = getServerDbClient().schema("public");
  const { data, error } = await db
    .from("wallet_denylist")
    .select("*")
    .order("added_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    throw new WalletDenylistRepositoryError(
      `Failed to list denylist entries: ${error.message}`,
      error.code,
    );
  }

  return data ?? [];
}
