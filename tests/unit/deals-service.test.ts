import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { ConsultationLinkRow, DealRow } from "../../lib/db/types";
import { handleFundedEvent } from "../../server/services/deals";

interface DealsServiceMocks {
  getByConsultationLinkId: (...args: unknown[]) => Promise<DealRow | null>;
  getById: (...args: unknown[]) => Promise<ConsultationLinkRow | null>;
  getByOnchainDealId: (...args: unknown[]) => Promise<DealRow | null>;
  insertConfirmedDeal: (...args: unknown[]) => Promise<DealRow>;
  updateStatus: (...args: unknown[]) => Promise<ConsultationLinkRow>;
}

const mocks = (global as typeof globalThis & { __dealsServiceMocks: DealsServiceMocks }).__dealsServiceMocks;

function makeLink(overrides: Partial<ConsultationLinkRow> = {}): ConsultationLinkRow {
  return {
    id: "link-id-1",
    creator_user_id: "user-id-1",
    expert_address: "0xExpert",
    title: "Consult",
    description: "Desc",
    price_usdc: "100.00",
    scheduled_at: "2026-04-12T12:00:00.000Z",
    timezone: "UTC",
    expires_at: "2026-04-11T12:00:00.000Z",
    duration_minutes: 30,
    meeting_url_encrypted: "encrypted",
    link_hash: "0x" + "1".repeat(64),
    status: "Open",
    created_at: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    id: "deal-id-1",
    consultation_link_id: "link-id-1",
    onchain_deal_id: "1",
    buyer_address: "0xBuyer",
    seller_address: "0xExpert",
    status: "Funded",
    funded_at: null,
    completed_at: null,
    released_at: null,
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    tx_hash: "0x" + "2".repeat(64),
    created_at: "2026-04-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getByConsultationLinkId = async () => null;
  mocks.getById = async () => makeLink();
  mocks.getByOnchainDealId = async () => null;
  mocks.insertConfirmedDeal = async () => makeDeal();
  mocks.updateStatus = async () => makeLink({ status: "Consumed" });
});

describe("handleFundedEvent", () => {
  test("does not transition a time-expired raw Open link to Consumed", async () => {
    let updateCalls = 0;

    mocks.getById = async () => makeLink({
      status: "Open",
      expires_at: "2026-04-10T12:00:00.000Z",
    });
    mocks.updateStatus = async () => {
      updateCalls += 1;
      return makeLink({ status: "Consumed" });
    };

    const result = await handleFundedEvent(
      {
        buyerAddress: "0xBuyer",
        consultationLinkId: "link-id-1",
        fundedAt: null,
        onchainDealId: "1",
        sellerAddress: "0xExpert",
        status: "Funded",
        txHash: "0x" + "2".repeat(64),
      },
      new Date("2026-04-10T12:00:00.000Z"),
    );

    assert.equal(result.id, "deal-id-1");
    assert.equal(updateCalls, 0);
  });
});
