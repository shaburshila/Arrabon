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
const dealsAdminServicePath = path.resolve(root, "server/services/deals-admin.ts");

require.cache[require.resolve("server-only")] = makeEntry("server-only", {});

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

class DealAdminServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DealAdminServiceError";
    this.status = status;
  }
}

const routeMocks: {
  getAdminDealCompliance: (_input: unknown) => Promise<unknown>;
  getAdminDealReview: (_input: unknown) => Promise<unknown>;
  parseDealRouteParams: (params: { id?: string | undefined }) => { dealId: string };
  requireAdmin: () => Promise<{
    avatar_url: null;
    expires_at: string;
    id: string;
    is_admin: boolean;
    username: null;
    wallet_address: string;
  }>;
} = {
  getAdminDealCompliance: async () => ({ ok: true }),
  getAdminDealReview: async () => ({ ok: true }),
  parseDealRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
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
require.cache[dealValidatorsPath] = makeEntry(dealValidatorsPath, {
  DealValidationError,
  parseDealRouteParams: (params: { id?: string | undefined }) =>
    routeMocks.parseDealRouteParams(params),
});
require.cache[dealsAdminServicePath] = makeEntry(dealsAdminServicePath, {
  DealAdminServiceError,
  getAdminDealCompliance: (input: unknown) => routeMocks.getAdminDealCompliance(input),
  getAdminDealReview: (input: unknown) => routeMocks.getAdminDealReview(input),
});

const { GET: getDealReview } = require("../../app/api/admin/deals/[id]/route");
const { GET: getDealCompliance } = require("../../app/api/admin/deals/[id]/compliance/route");

beforeEach(() => {
  routeMocks.getAdminDealCompliance = async () => ({ ok: true });
  routeMocks.getAdminDealReview = async () => ({ ok: true });
  routeMocks.parseDealRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.requireAdmin = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "admin-id-1",
    is_admin: true,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("admin deal compliance routes", () => {
  test("deal review route returns extended review payload", async () => {
    routeMocks.getAdminDealReview = async () => ({
      compliance_summary: { checks_count: 0 },
      id: "deal-id-1",
      risk_status: "Clear",
    });

    const response = await getDealReview(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      compliance_summary: { checks_count: 0 },
      id: "deal-id-1",
      risk_status: "Clear",
    });
  });

  test("deal compliance route returns compliance detail payload", async () => {
    routeMocks.getAdminDealCompliance = async () => ({
      checks: [],
      compliance_summary: { checks_count: 0 },
      deal_id: "deal-id-1",
      risk_status: "Clear",
    });

    const response = await getDealCompliance(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      checks: [],
      compliance_summary: { checks_count: 0 },
      deal_id: "deal-id-1",
      risk_status: "Clear",
    });
  });

  test("deal compliance route returns 403 for non-admin", async () => {
    routeMocks.requireAdmin = async () => {
      throw new AuthGuardError("Access denied.", 403);
    };

    const response = await getDealCompliance(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      error: "Access denied.",
    });
  });
});
