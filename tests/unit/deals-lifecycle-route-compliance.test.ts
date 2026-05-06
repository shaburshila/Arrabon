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
const validatorsPath = path.resolve(root, "lib/validators/deals-completion.ts");
const servicePath = path.resolve(root, "server/services/deals-completion.ts");

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

class DealCompletionValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid deal lifecycle params.");
    this.name = "DealCompletionValidationError";
    this.issues = issues;
  }
}

class DealCompletionServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DealCompletionServiceError";
    this.status = status;
  }
}

type RouteUser = {
  avatar_url: null;
  expires_at: string;
  id: string;
  is_admin: boolean;
  username: null;
  wallet_address: string;
};

type RouteMocks = {
  parseDealCompletionRouteParams: (
    params: { id?: string | undefined },
  ) => { dealId: string };
  prepareOpenDisputeForDeal: (currentUser: unknown, params: unknown) => Promise<unknown>;
  prepareAutoReleaseForDeal: (currentUser: unknown, params: unknown) => Promise<unknown>;
  prepareConfirmReleaseForDeal: (currentUser: unknown, params: unknown) => Promise<unknown>;
  prepareMarkCompletedForDeal: (currentUser: unknown, params: unknown) => Promise<unknown>;
  requireUser: () => Promise<RouteUser>;
};

const routeMocks: RouteMocks = {
  parseDealCompletionRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
  prepareOpenDisputeForDeal: async () => ({ ok: true }),
  prepareAutoReleaseForDeal: async () => ({ ok: true }),
  prepareConfirmReleaseForDeal: async () => ({ ok: true }),
  prepareMarkCompletedForDeal: async () => ({ ok: true }),
  requireUser: async (): Promise<RouteUser> => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  }),
};

(require.cache as Record<string, unknown>)[authGuardsPath] = makeEntry(authGuardsPath, {
  AuthGuardError,
  requireUser: () => routeMocks.requireUser(),
});
(require.cache as Record<string, unknown>)[validatorsPath] = makeEntry(validatorsPath, {
  DealCompletionValidationError,
  parseDealCompletionRouteParams: (params: { id?: string | undefined }) =>
    routeMocks.parseDealCompletionRouteParams(params),
});
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  DealCompletionServiceError,
  prepareOpenDisputeForDeal: (currentUser: unknown, params: unknown) =>
    routeMocks.prepareOpenDisputeForDeal(currentUser, params),
  prepareAutoReleaseForDeal: (currentUser: unknown, params: unknown) =>
    routeMocks.prepareAutoReleaseForDeal(currentUser, params),
  prepareConfirmReleaseForDeal: (currentUser: unknown, params: unknown) =>
    routeMocks.prepareConfirmReleaseForDeal(currentUser, params),
  prepareMarkCompletedForDeal: (currentUser: unknown, params: unknown) =>
    routeMocks.prepareMarkCompletedForDeal(currentUser, params),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST: completePost } = require("../../app/api/deals/[id]/complete/route");
const { POST: releasePost } = require("../../app/api/deals/[id]/release/route");
const { POST: autoReleasePost } = require("../../app/api/deals/[id]/auto-release/route");
const { POST: disputePost } = require("../../app/api/deals/[id]/dispute/route");

beforeEach(() => {
  routeMocks.parseDealCompletionRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.prepareOpenDisputeForDeal = async () => ({ ok: true });
  routeMocks.prepareAutoReleaseForDeal = async () => ({ ok: true });
  routeMocks.prepareConfirmReleaseForDeal = async () => ({ ok: true });
  routeMocks.prepareMarkCompletedForDeal = async () => ({ ok: true });
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("deal lifecycle compliance routes", () => {
  test("dispute route returns 201 on success", async () => {
    const response = await disputePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 201);
  });

  test("complete route returns canonical 403 shape", async () => {
    routeMocks.prepareMarkCompletedForDeal = async (
      _currentUser: unknown,
      _params: unknown,
    ) => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "local_denylist",
        reasonCode: "LOCAL_DENYLIST",
        walletAddress: "0x00000000000000000000000000000000000000AA",
      });
    };

    const response = await completePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet blocked by compliance screening.",
      reason_code: "LOCAL_DENYLIST",
      wallet_address: "0x00000000000000000000000000000000000000aa",
    });
  });

  test("release route returns canonical 403 shape", async () => {
    routeMocks.prepareConfirmReleaseForDeal = async (
      _currentUser: unknown,
      _params: unknown,
    ) => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "OFAC_SANCTIONS",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      });
    };

    const response = await releasePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet flagged by sanctions screening.",
      reason_code: "OFAC_SANCTIONS",
      wallet_address: "0x00000000000000000000000000000000000000bb",
    });
  });

  test("auto-release route returns canonical 403 shape", async () => {
    routeMocks.prepareAutoReleaseForDeal = async (_currentUser: unknown, _params: unknown) => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "PROVIDER_UNAVAILABLE",
        walletAddress: "0x00000000000000000000000000000000000000CC",
      });
    };

    const response = await autoReleasePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: "COMPLIANCE_BLOCKED",
      error: "Compliance screening is temporarily unavailable.",
      reason_code: "PROVIDER_UNAVAILABLE",
      wallet_address: "0x00000000000000000000000000000000000000cc",
    });
    assert.equal("details" in body, false);
  });

  test("auto-release route requires authenticated user", async () => {
    routeMocks.requireUser = async () => {
      throw new AuthGuardError("Authentication required.", 401);
    };

    const response = await autoReleasePost(new Request("http://localhost"), {
      params: Promise.resolve({ id: "deal-id-1" }),
    });

    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), {
      error: "Authentication required.",
    });
  });
});
