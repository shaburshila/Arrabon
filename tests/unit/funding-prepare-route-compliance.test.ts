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
  parsePrepareFundingParams: (params: { id?: string | undefined }) => { linkId: string };
  prepareFundingForLink: (currentUser: unknown, params: unknown) => Promise<unknown>;
  requireUser: () => Promise<RouteUser>;
};

const routeMocks: RouteMocks = {
  parsePrepareFundingParams: () => ({ linkId: "link-id-1" }),
  prepareFundingForLink: async () => ({ ok: true }),
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
  parsePrepareFundingParams: (params: { id?: string | undefined }) =>
    routeMocks.parsePrepareFundingParams(params),
});
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  FundingServiceError,
  prepareFundingForLink: (currentUser: unknown, params: unknown) =>
    routeMocks.prepareFundingForLink(currentUser, params),
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/links/[id]/funding/prepare/route");

beforeEach(() => {
  routeMocks.parsePrepareFundingParams = () => ({ linkId: "link-id-1" });
  routeMocks.prepareFundingForLink = async () => ({ ok: true });
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("POST /api/links/[id]/funding/prepare compliance route", () => {
  test("returns canonical 403 shape for ComplianceBlockedError", async () => {
    routeMocks.prepareFundingForLink = async (_currentUser: unknown, _params: unknown) => {
      throw new ComplianceBlockedError({
        dealId: null,
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "PROVIDER_UNAVAILABLE",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      });
    };

    const response = await POST(
      new Request("http://localhost/api/links/link-id-1/funding/prepare", {
        method: "POST",
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
    assert.equal("details" in body, false);
    assert.equal("status" in body, false);
  });
});
