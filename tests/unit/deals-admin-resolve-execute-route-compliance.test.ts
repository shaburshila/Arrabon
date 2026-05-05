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
  } as const;
}

const root = path.resolve(__dirname, "../..");
const authGuardsPath = path.resolve(root, "lib/auth/guards.ts");
const dealValidatorsPath = path.resolve(root, "lib/validators/deals.ts");
const payoutGrantValidatorsPath = path.resolve(root, "lib/validators/payout-execution-grants.ts");
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

class PayoutExecutionGrantValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid payout execution grant body.");
    this.name = "PayoutExecutionGrantValidationError";
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
  exchangeAdminResolveGrantForDeal: (
    currentUser: unknown,
    params: unknown,
    grantToken: unknown,
  ) => Promise<unknown>;
  parseDealRouteParams: (params: { id?: string | undefined }) => { dealId: string };
  parsePayoutExecutionGrantBody: (body: unknown) => { grant_token: string };
  requireAdmin: () => Promise<AdminUser>;
};

const routeMocks: RouteMocks = {
  exchangeAdminResolveGrantForDeal: async () => ({ ok: true }),
  parseDealRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
  parsePayoutExecutionGrantBody: () => ({ grant_token: "a".repeat(64) }),
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
(require.cache as Record<string, unknown>)[payoutGrantValidatorsPath] = makeEntry(
  payoutGrantValidatorsPath,
  {
    PayoutExecutionGrantValidationError,
    parsePayoutExecutionGrantBody: (body: unknown) =>
      routeMocks.parsePayoutExecutionGrantBody(body),
  },
);
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  DealAdminServiceError,
  exchangeAdminResolveGrantForDeal: (
    currentUser: unknown,
    params: unknown,
    grantToken: unknown,
  ) => routeMocks.exchangeAdminResolveGrantForDeal(currentUser, params, grantToken),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/admin/deals/[id]/resolve/execute/route");

beforeEach(() => {
  routeMocks.exchangeAdminResolveGrantForDeal = async () => ({ ok: true });
  routeMocks.parseDealRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.parsePayoutExecutionGrantBody = () => ({ grant_token: "a".repeat(64) });
  routeMocks.requireAdmin = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("admin resolve execute compliance route", () => {
  test("returns 400 for invalid JSON body", async () => {
    const response = await POST(
      new Request("http://localhost", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id: "deal-id-1" }) },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Invalid JSON body.",
    });
  });

  test("returns canonical 403 shape", async () => {
    routeMocks.exchangeAdminResolveGrantForDeal = async () => {
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
        body: JSON.stringify({ grant_token: "a".repeat(64) }),
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
