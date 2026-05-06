import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type { DealActionContextRow } from "../../server/repositories/deals";
import {
  createDisputeMessageForDeal,
  DisputeMessagesServiceError,
  listDisputeMessagesForDeal,
} from "../../server/services/dispute-messages";

interface DisputeMessagesMocks {
  createAuditLogEntry: (...args: unknown[]) => Promise<unknown>;
  createMessage: (...args: unknown[]) => Promise<unknown>;
  getDealActionContextById: (...args: unknown[]) => Promise<DealActionContextRow | null>;
  listByDealId: (...args: unknown[]) => Promise<unknown[]>;
}

const mocks = (global as typeof globalThis & { __disputeMessagesMocks: DisputeMessagesMocks }).__disputeMessagesMocks;

const BUYER = "0x0000000000000000000000000000000000000002";
const SELLER = "0x0000000000000000000000000000000000000001";
const OUTSIDER = "0x0000000000000000000000000000000000000003";
const ADMIN = "0x0000000000000000000000000000000000000004";

function makeUser(wallet: string, isAdmin = false): CurrentUserContext {
  return {
    avatar_url: null,
    expires_at: "2026-04-18T00:00:00.000Z",
    id: "user-id",
    is_admin: isAdmin,
    username: null,
    wallet_address: wallet,
  };
}

function makeContext(overrides: Partial<DealActionContextRow> = {}): DealActionContextRow {
  return {
    buyer_address: BUYER,
    completed_at: null,
    consultation_link_id: "link-id-1",
    duration_minutes: 60,
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    risk_status: "Clear",
    scheduled_at: "2026-04-17T10:00:00.000Z",
    seller_address: SELLER,
    status: "Disputed",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.createAuditLogEntry = async () => ({});
  mocks.getDealActionContextById = async () => makeContext();
  mocks.listByDealId = async () => [
    {
      author_role: "buyer",
      author_wallet: BUYER,
      body: "Buyer position",
      created_at: "2026-04-17T10:00:00.000Z",
      deal_id: "deal-id-1",
      evidence_url: null,
      id: "message-id-1",
    },
  ];
  mocks.createMessage = async (input: any) => ({
    author_role: input.authorRole,
    author_wallet: input.authorWallet,
    body: input.body,
    created_at: "2026-04-17T10:01:00.000Z",
    deal_id: input.dealId,
    evidence_url: input.evidenceUrl,
    id: "message-id-2",
  });
});

describe("listDisputeMessagesForDeal", () => {
  test("allows buyer, seller, and admin to read", async () => {
    assert.equal(
      (await listDisputeMessagesForDeal(makeUser(BUYER), { dealId: "deal-id-1" })).length,
      1,
    );
    assert.equal(
      (await listDisputeMessagesForDeal(makeUser(SELLER), { dealId: "deal-id-1" })).length,
      1,
    );
    assert.equal(
      (await listDisputeMessagesForDeal(makeUser(ADMIN, true), { dealId: "deal-id-1" })).length,
      1,
    );
  });

  test("allows reading after dispute resolution", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Released" });

    const result = await listDisputeMessagesForDeal(makeUser(BUYER), { dealId: "deal-id-1" });

    assert.equal(result.length, 1);
  });

  test("rejects outsider read", async () => {
    await assert.rejects(
      () => listDisputeMessagesForDeal(makeUser(OUTSIDER), { dealId: "deal-id-1" }),
      (error: unknown) => {
        assert.ok(error instanceof DisputeMessagesServiceError);
        assert.equal(error.status, 403);
        assert.equal(error.code, "NOT_DISPUTE_PARTICIPANT");
        return true;
      },
    );
  });
});

describe("createDisputeMessageForDeal", () => {
  test("creates buyer message while disputed and writes audit fail-open", async () => {
    let auditCalled = false;
    mocks.createAuditLogEntry = async () => {
      auditCalled = true;
      throw new Error("audit down");
    };

    const result = await createDisputeMessageForDeal(
      makeUser(BUYER),
      { dealId: "deal-id-1" },
      { body: "Buyer evidence", evidence_url: "https://example.com" },
    );

    assert.equal(result.author_role, "buyer");
    assert.equal(result.body, "Buyer evidence");
    assert.equal(result.evidence_url, "https://example.com");
    assert.equal(auditCalled, true);
  });

  test("creates seller and admin messages while disputed", async () => {
    assert.equal(
      (await createDisputeMessageForDeal(
        makeUser(SELLER),
        { dealId: "deal-id-1" },
        { body: "Seller response", evidence_url: null },
      )).author_role,
      "seller",
    );
    assert.equal(
      (await createDisputeMessageForDeal(
        makeUser(ADMIN, true),
        { dealId: "deal-id-1" },
        { body: "Admin question", evidence_url: null },
      )).author_role,
      "admin",
    );
  });

  test("rejects post after resolution", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Refunded" });

    await assert.rejects(
      () => createDisputeMessageForDeal(
        makeUser(BUYER),
        { dealId: "deal-id-1" },
        { body: "Too late", evidence_url: null },
      ),
      (error: unknown) => {
        assert.ok(error instanceof DisputeMessagesServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_NOT_DISPUTED");
        return true;
      },
    );
  });

  test("returns 404 when deal is missing", async () => {
    mocks.getDealActionContextById = async () => null;

    await assert.rejects(
      () => createDisputeMessageForDeal(
        makeUser(BUYER),
        { dealId: "deal-id-1" },
        { body: "Missing deal", evidence_url: null },
      ),
      (error: unknown) => {
        assert.ok(error instanceof DisputeMessagesServiceError);
        assert.equal(error.status, 404);
        assert.equal(error.code, "DEAL_NOT_FOUND");
        return true;
      },
    );
  });
});
