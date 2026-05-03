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
const disputeMessageValidatorsPath = path.resolve(root, "lib/validators/dispute-messages.ts");
const disputeMessagesServicePath = path.resolve(root, "server/services/dispute-messages.ts");

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

class DisputeMessageValidationError extends Error {
  issues: unknown[];

  constructor(issues: unknown[]) {
    super("Invalid dispute message body.");
    this.name = "DisputeMessageValidationError";
    this.issues = issues;
  }
}

class DisputeMessagesServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DisputeMessagesServiceError";
    this.status = status;
  }
}

type User = {
  avatar_url: null;
  expires_at: string;
  id: string;
  is_admin: boolean;
  username: null;
  wallet_address: string;
};

type RouteMocks = {
  createDisputeMessageForDeal: (...args: unknown[]) => Promise<unknown>;
  listDisputeMessagesForDeal: (...args: unknown[]) => Promise<unknown>;
  parseCreateDisputeMessageBody: (_body: unknown) => { body: string; evidence_url: string | null };
  parseDealRouteParams: (params: { id?: string | undefined }) => { dealId: string };
  requireUser: () => Promise<User>;
};

const routeMocks: RouteMocks = {
  createDisputeMessageForDeal: async () => ({ id: "message-id-1" }),
  listDisputeMessagesForDeal: async () => [],
  parseCreateDisputeMessageBody: (_body: unknown) => ({
    body: "Buyer evidence",
    evidence_url: null,
  }),
  parseDealRouteParams: (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  }),
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
(require.cache as Record<string, unknown>)[dealValidatorsPath] = makeEntry(dealValidatorsPath, {
  DealValidationError,
  parseDealRouteParams: (params: { id?: string | undefined }) => routeMocks.parseDealRouteParams(params),
});
(require.cache as Record<string, unknown>)[disputeMessageValidatorsPath] = makeEntry(disputeMessageValidatorsPath, {
  DisputeMessageValidationError,
  parseCreateDisputeMessageBody: (body: unknown) => routeMocks.parseCreateDisputeMessageBody(body),
});
(require.cache as Record<string, unknown>)[disputeMessagesServicePath] = makeEntry(disputeMessagesServicePath, {
  DisputeMessagesServiceError,
  createDisputeMessageForDeal: (...args: unknown[]) => routeMocks.createDisputeMessageForDeal(...args),
  listDisputeMessagesForDeal: (...args: unknown[]) => routeMocks.listDisputeMessagesForDeal(...args),
});

const { POST } = require("../../app/api/deals/[id]/dispute-messages/route");

beforeEach(() => {
  routeMocks.createDisputeMessageForDeal = async () => ({ id: "message-id-1" });
  routeMocks.listDisputeMessagesForDeal = async () => [];
  routeMocks.parseCreateDisputeMessageBody = (_body: unknown) => ({
    body: "Buyer evidence",
    evidence_url: null,
  });
  routeMocks.parseDealRouteParams = (params: { id?: string | undefined }) => ({
    dealId: params.id ?? "deal-id-1",
  });
  routeMocks.requireUser = async () => ({
    avatar_url: null,
    expires_at: "2026-04-28T00:00:00.000Z",
    id: "user-id-1",
    is_admin: false,
    username: null,
    wallet_address: "0x00000000000000000000000000000000000000AA",
  });
});

describe("dispute messages route", () => {
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
});
