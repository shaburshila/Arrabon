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
const validatorsPath = path.resolve(root, "lib/validators/funding.ts");
const servicePath = path.resolve(root, "server/services/funding.ts");

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

class FundingValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid funding preparation input.");
    this.name = "FundingValidationError";
    this.issues = issues;
  }
}

class FundingServiceError extends Error {
  status: number;
  statusValue?: string;

  constructor(message: string, status: number, statusValue?: string) {
    super(message);
    this.name = "FundingServiceError";
    this.status = status;
    this.statusValue = statusValue;
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
  exchangeFundingGrantForLink: (currentUser: unknown, params: unknown, grantToken: unknown) => Promise<unknown>;
  parseFundingExecutionGrantBody: (body: unknown) => { grant_token: string };
  parsePrepareFundingParams: (params: { id?: string | undefined }) => { linkId: string };
  requireUser: () => Promise<RouteUser>;
};

const routeMocks: RouteMocks = {
  exchangeFundingGrantForLink: async () => ({ ok: true }),
  parseFundingExecutionGrantBody: () => ({ grant_token: "a".repeat(64) }),
  parsePrepareFundingParams: () => ({ linkId: "link-id-1" }),
  requireUser: async () => ({
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
  FundingValidationError,
  parseFundingExecutionGrantBody: (body: unknown) => routeMocks.parseFundingExecutionGrantBody(body),
  parsePrepareFundingParams: (params: { id?: string | undefined }) =>
    routeMocks.parsePrepareFundingParams(params),
});
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  FundingServiceError,
  exchangeFundingGrantForLink: (currentUser: unknown, params: unknown, grantToken: unknown) =>
    routeMocks.exchangeFundingGrantForLink(currentUser, params, grantToken),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/links/[id]/funding/execute/route");

beforeEach(() => {
  routeMocks.exchangeFundingGrantForLink = async () => ({ ok: true });
  routeMocks.parseFundingExecutionGrantBody = () => ({ grant_token: "a".repeat(64) });
  routeMocks.parsePrepareFundingParams = () => ({ linkId: "link-id-1" });
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("POST /api/links/[id]/funding/execute compliance route", () => {
  test("returns 400 for invalid JSON body", async () => {
    const response = await POST(
      new Request("http://localhost/api/links/link-id-1/funding/execute", {
        body: "{",
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
      { params: Promise.resolve({ id: "link-id-1" }) },
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid JSON body." });
  });

  test("returns canonical 403 shape for ComplianceBlockedError", async () => {
    routeMocks.exchangeFundingGrantForLink = async () => {
      throw new ComplianceBlockedError({
        dealId: null,
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "PROVIDER_UNAVAILABLE",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      });
    };

    const response = await POST(
      new Request("http://localhost/api/links/link-id-1/funding/execute", {
        method: "POST",
        body: JSON.stringify({ grant_token: "a".repeat(64) }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "link-id-1" }) },
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: "COMPLIANCE_BLOCKED",
      error: "Compliance screening is temporarily unavailable.",
      reason_code: "PROVIDER_UNAVAILABLE",
      wallet_address: "0x00000000000000000000000000000000000000bb",
    });
  });

  test("returns 410 body with status for stale link errors", async () => {
    routeMocks.exchangeFundingGrantForLink = async () => {
      throw new FundingServiceError("Link has expired.", 410, "Expired");
    };

    const response = await POST(
      new Request("http://localhost/api/links/link-id-1/funding/execute", {
        method: "POST",
        body: JSON.stringify({ grant_token: "a".repeat(64) }),
        headers: { "content-type": "application/json" },
      }),
      { params: Promise.resolve({ id: "link-id-1" }) },
    );

    assert.equal(response.status, 410);
    assert.deepEqual(await response.json(), {
      error: "Link has expired.",
      status: "Expired",
    });
  });
});
