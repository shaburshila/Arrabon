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
const validatorsPath = path.resolve(root, "lib/validators/deals-completion.ts");
const payoutGrantValidatorsPath = path.resolve(root, "lib/validators/payout-execution-grants.ts");
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

class PayoutExecutionGrantValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid payout execution grant body.");
    this.name = "PayoutExecutionGrantValidationError";
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
  exchangeConfirmReleaseGrantForDeal: (
    currentUser: unknown,
    params: unknown,
    grantToken: unknown,
  ) => Promise<unknown>;
  parseDealCompletionRouteParams: (
    params: { id?: string | undefined },
  ) => { dealId: string };
  parsePayoutExecutionGrantBody: (body: unknown) => { grant_token: string };
  requireUser: () => Promise<RouteUser>;
};

const routeMocks: RouteMocks = {
  exchangeConfirmReleaseGrantForDeal: async () => ({ ok: true }),
  parseDealCompletionRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
  parsePayoutExecutionGrantBody: () => ({ grant_token: "a".repeat(64) }),
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
(require.cache as Record<string, unknown>)[payoutGrantValidatorsPath] = makeEntry(
  payoutGrantValidatorsPath,
  {
    PayoutExecutionGrantValidationError,
    parsePayoutExecutionGrantBody: (body: unknown) =>
      routeMocks.parsePayoutExecutionGrantBody(body),
  },
);
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  DealCompletionServiceError,
  exchangeConfirmReleaseGrantForDeal: (
    currentUser: unknown,
    params: unknown,
    grantToken: unknown,
  ) => routeMocks.exchangeConfirmReleaseGrantForDeal(currentUser, params, grantToken),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/deals/[id]/release/execute/route");

beforeEach(() => {
  routeMocks.exchangeConfirmReleaseGrantForDeal = async () => ({ ok: true });
  routeMocks.parseDealCompletionRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.parsePayoutExecutionGrantBody = () => ({ grant_token: "a".repeat(64) });
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("deal release execute compliance route", () => {
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
    routeMocks.exchangeConfirmReleaseGrantForDeal = async () => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "OFAC_SANCTIONS",
        walletAddress: "0x00000000000000000000000000000000000000BB",
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
    assert.deepEqual(await response.json(), {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet flagged by sanctions screening.",
      reason_code: "OFAC_SANCTIONS",
      wallet_address: "0x00000000000000000000000000000000000000bb",
    });
  });
});
