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
const authGuardsPath = path.resolve(root, "lib/auth/guards.ts");
const denylistValidatorsPath = path.resolve(root, "lib/validators/admin-denylist.ts");
const paginationValidatorsPath = path.resolve(root, "lib/validators/pagination.ts");
const denylistServicePath = path.resolve(root, "server/services/admin-denylist.ts");

require.cache[require.resolve("server-only")] = makeEntry("server-only", {});

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

class AdminDenylistValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid admin denylist input.");
    this.name = "AdminDenylistValidationError";
    this.issues = issues;
  }
}

class PaginationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationValidationError";
  }
}

class AdminDenylistServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AdminDenylistServiceError";
    this.status = status;
  }
}

const routeMocks: {
  addAdminDenylistEntry: (...args: unknown[]) => Promise<unknown>;
  listAdminDenylist: (...args: unknown[]) => Promise<unknown>;
  parseAddAdminDenylistBody: (_body: unknown) => {
    notes: null;
    reason: "fraud";
    wallet: string;
  };
  parseAdminDenylistWalletRouteParams: (params: { wallet?: string | undefined }) => {
    wallet: string;
  };
  parseListPagination: (_searchParams: URLSearchParams) => { limit: number; offset: number };
  parseRemoveAdminDenylistBody: (_body: unknown) => {
    comment: string;
  };
  removeAdminDenylistEntry: (...args: unknown[]) => Promise<unknown>;
  requireAdmin: () => Promise<{
    avatar_url: null;
    expires_at: string;
    id: string;
    is_admin: boolean;
    username: null;
    wallet_address: string;
  }>;
} = {
  addAdminDenylistEntry: async () => ({ ok: true }),
  listAdminDenylist: async () => [],
  parseAddAdminDenylistBody: (_body: unknown) => ({
    notes: null,
    reason: "fraud" as const,
    wallet: "0x00000000000000000000000000000000000000BB",
  }),
  parseAdminDenylistWalletRouteParams: (params: { wallet?: string | undefined }) => ({
    wallet: params.wallet ?? "0x00000000000000000000000000000000000000BB",
  }),
  parseListPagination: (_searchParams: URLSearchParams) => ({ limit: 50, offset: 0 }),
  parseRemoveAdminDenylistBody: (_body: unknown) => ({
    comment: "cleanup",
  }),
  removeAdminDenylistEntry: async () => ({ ok: true }),
  requireAdmin: async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  }),
};

require.cache[authGuardsPath] = makeEntry(authGuardsPath, {
  AuthGuardError,
  requireAdmin: () => routeMocks.requireAdmin(),
});
require.cache[denylistValidatorsPath] = makeEntry(denylistValidatorsPath, {
  AdminDenylistValidationError,
  parseAddAdminDenylistBody: (body: unknown) => routeMocks.parseAddAdminDenylistBody(body),
  parseAdminDenylistWalletRouteParams: (params: { wallet?: string | undefined }) =>
    routeMocks.parseAdminDenylistWalletRouteParams(params),
  parseRemoveAdminDenylistBody: (body: unknown) => routeMocks.parseRemoveAdminDenylistBody(body),
});
require.cache[paginationValidatorsPath] = makeEntry(paginationValidatorsPath, {
  PaginationValidationError,
  parseListPagination: (searchParams: URLSearchParams) => routeMocks.parseListPagination(searchParams),
});
require.cache[denylistServicePath] = makeEntry(denylistServicePath, {
  AdminDenylistServiceError,
  addAdminDenylistEntry: (currentUser: unknown, body: unknown) =>
    routeMocks.addAdminDenylistEntry(currentUser, body),
  listAdminDenylist: (pagination: unknown) => routeMocks.listAdminDenylist(pagination),
  removeAdminDenylistEntry: (currentUser: unknown, wallet: unknown, body: unknown) =>
    routeMocks.removeAdminDenylistEntry(currentUser, wallet, body),
});

const { GET, POST } = require("../../app/api/admin/denylist/route");
const { DELETE } = require("../../app/api/admin/denylist/[wallet]/route");

beforeEach(() => {
  routeMocks.addAdminDenylistEntry = async () => ({ ok: true });
  routeMocks.listAdminDenylist = async () => [];
  routeMocks.parseAddAdminDenylistBody = (_body: unknown) => ({
    notes: null,
    reason: "fraud" as const,
    wallet: "0x00000000000000000000000000000000000000BB",
  });
  routeMocks.parseAdminDenylistWalletRouteParams = (params: { wallet?: string | undefined }) => ({
    wallet: params.wallet ?? "0x00000000000000000000000000000000000000BB",
  });
  routeMocks.parseListPagination = (_searchParams: URLSearchParams) => ({ limit: 50, offset: 0 });
  routeMocks.parseRemoveAdminDenylistBody = (_body: unknown) => ({
    comment: "cleanup",
  });
  routeMocks.removeAdminDenylistEntry = async () => ({ ok: true });
  routeMocks.requireAdmin = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("admin denylist routes", () => {
  test("list route returns 403 for non-admin", async () => {
    routeMocks.requireAdmin = async () => {
      throw new AuthGuardError("Access denied.", 403);
    };

    const response = await GET(new Request("http://localhost"));

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "Access denied.",
    });
  });

  test("post route returns 400 for invalid JSON body", async () => {
    const response = await POST(
      new Request("http://localhost", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Invalid JSON body.",
    });
  });

  test("post route delegates validated body to service", async () => {
    let serviceArgs: unknown[] | null = null;
    routeMocks.addAdminDenylistEntry = async (...args: unknown[]) => {
      serviceArgs = args;
      return { wallet: "0xabc" };
    };

    const response = await POST(
      new Request("http://localhost", {
        body: JSON.stringify({ wallet: "0xabc", reason: "fraud", notes: null }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    assert.equal(response.status, 201);
    assert.ok(serviceArgs);
    assert.equal((serviceArgs[1] as { wallet: string }).wallet, "0x00000000000000000000000000000000000000BB");
  });

  test("delete route returns 400 when comment is missing", async () => {
    routeMocks.parseRemoveAdminDenylistBody = () => {
      throw new AdminDenylistValidationError([
        { field: "comment", message: "Required" },
      ]);
    };

    const response = await DELETE(
      new Request("http://localhost", {
        body: JSON.stringify({}),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          wallet: "0x00000000000000000000000000000000000000BB",
        }),
      },
    );

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.equal(body.error, "Invalid admin denylist input.");
  });

  test("delete route returns 400 for invalid JSON body", async () => {
    const response = await DELETE(
      new Request("http://localhost", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          wallet: "0x00000000000000000000000000000000000000BB",
        }),
      },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Invalid JSON body.",
    });
  });

  test("delete route delegates wallet and mandatory comment to service", async () => {
    let serviceArgs: unknown[] | null = null;
    routeMocks.removeAdminDenylistEntry = async (...args: unknown[]) => {
      serviceArgs = args;
      return { removed_wallet: "0xabc" };
    };

    const response = await DELETE(
      new Request("http://localhost", {
        body: JSON.stringify({ comment: "cleanup" }),
        headers: { "content-type": "application/json" },
        method: "DELETE",
      }),
      {
        params: Promise.resolve({
          wallet: "0x00000000000000000000000000000000000000BB",
        }),
      },
    );

    assert.equal(response.status, 200);
    assert.ok(serviceArgs);
    assert.equal(serviceArgs[1], "0x00000000000000000000000000000000000000BB");
    assert.deepEqual(serviceArgs[2], { comment: "cleanup" });
  });
});
