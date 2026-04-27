import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";

function makeEntry(id: string, exports: unknown) {
  return {
    id,
    filename: id,
    loaded: true,
    exports,
    paths: [],
    parent: null,
    children: [],
  } as any;
}

const root = path.resolve(__dirname, "../..");
const auditLogRepoPath = path.resolve(root, "server/repositories/audit-log.ts");
const walletDenylistRepoPath = path.resolve(root, "server/repositories/wallet-denylist.ts");

class AuditLogRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "AuditLogRepositoryError";
    this.code = code;
  }
}

class WalletDenylistRepositoryError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = "WalletDenylistRepositoryError";
    this.code = code;
  }
}

interface AdminDenylistServiceMocks {
  add: (...args: unknown[]) => Promise<unknown>;
  createAuditLogEntry: (...args: unknown[]) => Promise<unknown>;
  findByWallet: (...args: unknown[]) => Promise<unknown>;
  list: (...args: unknown[]) => Promise<unknown[]>;
  remove: (...args: unknown[]) => Promise<unknown>;
}

const mocks: AdminDenylistServiceMocks = {
  add: async () => ({
    added_at: "2026-04-27T00:00:00.000Z",
    added_by_wallet: "0xadmin",
    notes: null,
    reason: "fraud",
    wallet: "0xabc",
  }),
  createAuditLogEntry: async () => ({}),
  findByWallet: async () => null,
  list: async () => [],
  remove: async () => undefined,
};

require.cache[require.resolve("server-only")] = makeEntry("server-only", {});
require.cache[auditLogRepoPath] = makeEntry(auditLogRepoPath, {
  AuditLogRepositoryError,
  createAuditLogEntry: (...args: unknown[]) => mocks.createAuditLogEntry(...args),
});
require.cache[walletDenylistRepoPath] = makeEntry(walletDenylistRepoPath, {
  WalletDenylistRepositoryError,
  add: (...args: unknown[]) => mocks.add(...args),
  findByWallet: (...args: unknown[]) => mocks.findByWallet(...args),
  list: (...args: unknown[]) => mocks.list(...args),
  remove: (...args: unknown[]) => mocks.remove(...args),
});

const {
  addAdminDenylistEntry,
  AdminDenylistServiceError,
  listAdminDenylist,
  removeAdminDenylistEntry,
} = require("../../server/services/admin-denylist");

const adminUser = {
  avatar_url: null,
  expires_at: "2026-04-28T00:00:00.000Z",
  id: "admin-id-1",
  is_admin: true,
  username: null,
  wallet_address: "0x00000000000000000000000000000000000000AA",
};

beforeEach(() => {
  mocks.add = async () => ({
    added_at: "2026-04-27T00:00:00.000Z",
    added_by_wallet: "0x00000000000000000000000000000000000000aa",
    notes: null,
    reason: "fraud",
    wallet: "0x00000000000000000000000000000000000000bb",
  });
  mocks.createAuditLogEntry = async () => ({});
  mocks.findByWallet = async () => null;
  mocks.list = async () => [];
  mocks.remove = async () => undefined;
});

describe("admin denylist service", () => {
  test("lists entries with pagination", async () => {
    let receivedPagination: unknown = null;
    mocks.list = async (...args: unknown[]) => {
      [receivedPagination] = args;
      return [];
    };

    await listAdminDenylist({ limit: 10, offset: 5 });

    assert.deepEqual(receivedPagination, { limit: 10, offset: 5 });
  });

  test("adds entry and writes audit log", async () => {
    let auditInput: unknown = null;

    mocks.createAuditLogEntry = async (...args: unknown[]) => {
      [auditInput] = args;
      return {};
    };

    const result = await addAdminDenylistEntry(adminUser, {
      notes: "manual review",
      reason: "fraud",
      wallet: "0x00000000000000000000000000000000000000BB",
    });

    assert.equal(result.wallet, "0x00000000000000000000000000000000000000bb");
    assert.deepEqual(auditInput, {
      action: "admin_denylist_added",
      actorAddress: adminUser.wallet_address,
      entityId: "0x00000000000000000000000000000000000000bb",
      entityType: "wallet_denylist",
      metadata: {
        notes: null,
        reason: "fraud",
        wallet: "0x00000000000000000000000000000000000000bb",
      },
    });
  });

  test("rejects duplicate add", async () => {
    mocks.findByWallet = async () => ({
      added_at: "2026-04-27T00:00:00.000Z",
      added_by_wallet: "0xadmin",
      notes: null,
      reason: "fraud",
      wallet: "0x00000000000000000000000000000000000000bb",
    });

    await assert.rejects(
      () =>
        addAdminDenylistEntry(adminUser, {
          notes: null,
          reason: "fraud",
          wallet: "0x00000000000000000000000000000000000000BB",
        }),
      (error: unknown) => {
        assert.ok(error instanceof AdminDenylistServiceError);
        assert.equal((error as { status: number }).status, 409);
        assert.equal((error as { code: string }).code, "DENYLIST_ENTRY_EXISTS");
        return true;
      },
    );
  });

  test("removes entry and writes audit log with mandatory comment", async () => {
    let auditInput: unknown = null;

    mocks.findByWallet = async () => ({
      added_at: "2026-04-27T00:00:00.000Z",
      added_by_wallet: "0xadmin",
      notes: "note",
      reason: "abuse",
      wallet: "0x00000000000000000000000000000000000000bb",
    });
    mocks.createAuditLogEntry = async (...args: unknown[]) => {
      [auditInput] = args;
      return {};
    };

    const result = await removeAdminDenylistEntry(
      adminUser,
      "0x00000000000000000000000000000000000000BB",
      { comment: "cleared by legal" },
    );

    assert.deepEqual(result, {
      removed_wallet: "0x00000000000000000000000000000000000000bb",
    });
    assert.deepEqual(auditInput, {
      action: "admin_denylist_removed",
      actorAddress: adminUser.wallet_address,
      entityId: "0x00000000000000000000000000000000000000bb",
      entityType: "wallet_denylist",
      metadata: {
        comment: "cleared by legal",
        notes: "note",
        reason: "abuse",
        wallet: "0x00000000000000000000000000000000000000bb",
      },
    });
  });

  test("returns 404 when removing missing entry", async () => {
    mocks.findByWallet = async () => null;

    await assert.rejects(
      () =>
        removeAdminDenylistEntry(
          adminUser,
          "0x00000000000000000000000000000000000000BB",
          { comment: "missing" },
        ),
      (error: unknown) => {
        assert.ok(error instanceof AdminDenylistServiceError);
        assert.equal((error as { status: number }).status, 404);
        assert.equal((error as { code: string }).code, "DENYLIST_ENTRY_NOT_FOUND");
        return true;
      },
    );
  });
});
