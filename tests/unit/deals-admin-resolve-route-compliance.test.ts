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
const dealValidatorsPath = path.resolve(root, "lib/validators/deals.ts");
const adminValidatorsPath = path.resolve(root, "lib/validators/deals-admin.ts");
const servicePath = path.resolve(root, "server/services/deals-admin.ts");

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

class DealValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid deal route params.");
    this.name = "DealValidationError";
    this.issues = issues;
  }
}

class DealAdminValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid admin resolve body.");
    this.name = "DealAdminValidationError";
    this.issues = issues;
  }
}

class DealAdminServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DealAdminServiceError";
    this.status = status;
  }
}

type AdminUser = {
  avatar_url: null;
  expires_at: string;
  id: string;
  is_admin: boolean;
  username: null;
  wallet_address: string;
};

type RouteMocks = {
  parseAdminResolveBody: (_body: unknown) => { resolution: "release" };
  parseDealRouteParams: (params: { id?: string | undefined }) => { dealId: string };
  prepareAdminResolveForDeal: (
    currentUser: unknown,
    params: unknown,
    resolution: unknown,
  ) => Promise<unknown>;
  requireAdmin: () => Promise<AdminUser>;
};

const routeMocks: RouteMocks = {
  parseAdminResolveBody: (_body: unknown) => ({ resolution: "release" as const }),
  parseDealRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
  prepareAdminResolveForDeal: async () => ({ ok: true }),
  requireAdmin: async (): Promise<AdminUser> => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  }),
};

(require.cache as Record<string, unknown>)[authGuardsPath] = makeEntry(authGuardsPath, {
  AuthGuardError,
  requireAdmin: () => routeMocks.requireAdmin(),
});
(require.cache as Record<string, unknown>)[dealValidatorsPath] = makeEntry(dealValidatorsPath, {
  DealValidationError,
  parseDealRouteParams: (params: { id?: string | undefined }) =>
    routeMocks.parseDealRouteParams(params),
});
(require.cache as Record<string, unknown>)[adminValidatorsPath] = makeEntry(adminValidatorsPath, {
  DealAdminValidationError,
  parseAdminResolveBody: (body: unknown) => routeMocks.parseAdminResolveBody(body),
});
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  DealAdminServiceError,
  prepareAdminResolveForDeal: (currentUser: unknown, params: unknown, resolution: unknown) =>
    routeMocks.prepareAdminResolveForDeal(currentUser, params, resolution),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/admin/deals/[id]/resolve/route");

beforeEach(() => {
  routeMocks.parseAdminResolveBody = (_body: unknown) => ({ resolution: "release" as const });
  routeMocks.parseDealRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.prepareAdminResolveForDeal = async () => ({ ok: true });
  routeMocks.requireAdmin = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("admin resolve compliance route", () => {
  test("returns canonical 403 shape", async () => {
    routeMocks.prepareAdminResolveForDeal = async (
      _currentUser: unknown,
      _params: unknown,
      _resolution: unknown,
    ) => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "usdc_blacklist",
        reasonCode: "USDC_BLACKLISTED",
        walletAddress: "0x00000000000000000000000000000000000000DD",
      });
    };

    const response = await POST(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({ resolution: "release" }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "deal-id-1" }) },
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet blocked by token blacklist screening.",
      reason_code: "USDC_BLACKLISTED",
      wallet_address: "0x00000000000000000000000000000000000000dd",
    });
    assert.equal("details" in body, false);
  });
});
