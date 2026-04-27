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
const validatorsPath = path.resolve(root, "lib/validators/consultation-links.ts");
const paginationPath = path.resolve(root, "lib/validators/pagination.ts");
const servicePath = path.resolve(root, "server/services/consultation-links.ts");
const routePath = path.resolve(root, "app/api/links/route.ts");

class AuthGuardError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthGuardError";
    this.status = status;
  }
}

class ConsultationLinkValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid consultation link payload.");
    this.name = "ConsultationLinkValidationError";
    this.issues = issues;
  }
}

class PaginationValidationError extends Error {}

class ConsultationLinkServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ConsultationLinkServiceError";
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
  createConsultationLink: (
    currentUser: unknown,
    input: unknown,
  ) => Promise<{ id: string; link_hash: string; share_url: string; status: string }>;
  parseCreateConsultationLinkInput: (payload: unknown) => unknown;
  requireUser: () => Promise<RouteUser>;
};

const routeMocks: RouteMocks = {
  createConsultationLink: async () => ({
    id: "link-id-1",
    link_hash: "0x1",
    share_url: "/link/1",
    status: "Open",
  }),
  parseCreateConsultationLinkInput: (payload: unknown) => payload,
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
  ConsultationLinkValidationError,
  parseCreateConsultationLinkInput: (payload: unknown) =>
    routeMocks.parseCreateConsultationLinkInput(payload),
});
(require.cache as Record<string, unknown>)[paginationPath] = makeEntry(paginationPath, {
  PaginationValidationError,
  parseListPagination: () => ({ limit: 20, offset: 0 }),
});
(require.cache as Record<string, unknown>)[servicePath] = makeEntry(servicePath, {
  ConsultationLinkServiceError,
  createConsultationLink: (currentUser: unknown, input: unknown) =>
    routeMocks.createConsultationLink(currentUser, input),
  listMyConsultationLinks: async () => [],
});

const { ComplianceBlockedError } = require("../../lib/compliance/error-mapping");
const { POST } = require("../../app/api/links/route");

beforeEach(() => {
  routeMocks.createConsultationLink = async () => ({
    id: "link-id-1",
    link_hash: "0x1",
    share_url: "/link/1",
    status: "Open",
  });
  routeMocks.parseCreateConsultationLinkInput = (payload: unknown) => payload;
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("POST /api/links compliance route", () => {
  test("returns canonical 403 shape for ComplianceBlockedError", async () => {
    routeMocks.createConsultationLink = async (_currentUser: unknown, _input: unknown) => {
      throw new ComplianceBlockedError({
        dealId: null,
        provider: "local_denylist",
        reasonCode: "LOCAL_DENYLIST",
        walletAddress: "0x00000000000000000000000000000000000000AA",
      });
    };

    const response = await POST(
      new Request("http://localhost/api/links", {
        method: "POST",
        body: JSON.stringify({ title: "x" }),
        headers: { "content-type": "application/json" },
      }),
    );

    assert.equal(response.status, 403);
    const body = await response.json();
    assert.deepEqual(body, {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet blocked by compliance screening.",
      reason_code: "LOCAL_DENYLIST",
      wallet_address: "0x00000000000000000000000000000000000000aa",
    });
    assert.equal("details" in body, false);
  });
});
