import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type {
  DealReadViewRow,
  DealRevealContextRow,
} from "../../server/repositories/deals";
import {
  DealReadServiceError,
  getDealReadModel,
  revealMeetingUrlForDeal,
} from "../../server/services/deals-read";

interface DealsReadMocks {
  createAuditLogEntry: (...args: unknown[]) => Promise<void>;
  getDealReadViewById: (...args: unknown[]) => Promise<DealReadViewRow | null>;
  getDealRevealContextById: (...args: unknown[]) => Promise<DealRevealContextRow | null>;
}

const mocks = (global as typeof globalThis & { __dealsReadMocks: DealsReadMocks }).__dealsReadMocks;

const BUYER = "0x0000000000000000000000000000000000000002";
const SELLER = "0x0000000000000000000000000000000000000001";

const currentUser: CurrentUserContext = {
  avatar_url: null,
  expires_at: "2026-04-12T12:00:00.000Z",
  id: "user-id-1",
  is_admin: false,
  username: null,
  wallet_address: BUYER,
};

function makeContext(overrides: Partial<DealRevealContextRow> = {}): DealRevealContextRow {
  return {
    buyer_address: BUYER,
    consultation_link_id: "link-id-1",
    consultation_link_status: "Consumed",
    deal_id: "deal-id-1",
    expert_address: SELLER,
    meeting_url_encrypted: "encrypted",
    seller_address: SELLER,
    status: "Funded",
    ...overrides,
  };
}

function makeReadView(overrides: Partial<DealReadViewRow> = {}): DealReadViewRow {
  return {
    buyer_address: BUYER,
    completed_at: null,
    consultation_link_id: "link-id-1",
    duration_minutes: 60,
    grace_period_minutes: 15,
    id: "deal-id-1",
    onchain_deal_id: "1",
    price_usdc: "125.50",
    scheduled_at: "2026-04-12T14:00:00.000Z",
    seller_address: SELLER,
    status: "Funded",
    tx_hash: "0x" + "a".repeat(64),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.createAuditLogEntry = async () => undefined;
  mocks.getDealReadViewById = async () => makeReadView();
  mocks.getDealRevealContextById = async () => makeContext();
});

describe("getDealReadModel", () => {
  test("includes price_usdc from the deal read view", async () => {
    mocks.getDealReadViewById = async () => makeReadView({ price_usdc: "250.00" });

    const result = await getDealReadModel({ dealId: "deal-id-1" });

    assert.equal(result.price_usdc, "250.00");
  });
});

describe("revealMeetingUrlForDeal refunded policy", () => {
  test("rejects refunded deals with 409 DEAL_REVEAL_NOT_ALLOWED", async () => {
    mocks.getDealRevealContextById = async () => makeContext({ status: "Refunded" });

    await assert.rejects(
      () => revealMeetingUrlForDeal(currentUser, { dealId: "deal-id-1" }),
      (error: unknown) => {
        assert.ok(error instanceof DealReadServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_REVEAL_NOT_ALLOWED");
        return true;
      },
    );
  });
});
