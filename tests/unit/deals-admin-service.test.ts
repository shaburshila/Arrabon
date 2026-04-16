import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type {
  AdminDealReviewRow,
  DealActionContextRow,
} from "../../server/repositories/deals";
import {
  DealAdminServiceError,
  getAdminDealReview,
  listAdminDisputedDeals,
  prepareAdminResolveForDeal,
} from "../../server/services/deals-admin";

interface DealsAdminMocks {
  getAdminDealReviewRowById: (...args: unknown[]) => Promise<AdminDealReviewRow | null>;
  getDealActionContextById: (...args: unknown[]) => Promise<DealActionContextRow | null>;
  listDisputedDealReviewRows: (...args: unknown[]) => Promise<AdminDealReviewRow[]>;
}

const mocks = (global as typeof globalThis & { __dealsAdminMocks: DealsAdminMocks }).__dealsAdminMocks;

function makeActionContext(
  overrides: Partial<DealActionContextRow> = {},
): DealActionContextRow {
  return {
    buyer_address: "0x0000000000000000000000000000000000000002",
    completed_at: "2026-04-10T00:00:00.000Z",
    consultation_link_id: "link-id-1",
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    scheduled_at: "2026-04-09T00:00:00.000Z",
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Disputed",
    ...overrides,
  };
}

function makeReviewRow(
  overrides: Partial<AdminDealReviewRow> = {},
): AdminDealReviewRow {
  return {
    buyer_address: "0x0000000000000000000000000000000000000002",
    completed_at: "2026-04-10T00:00:00.000Z",
    consultation_link_id: "link-id-1",
    created_at: "2026-04-08T00:00:00.000Z",
    duration_minutes: 60,
    expires_at: "2026-04-09T00:00:00.000Z",
    id: "deal-id-1",
    onchain_deal_id: "42",
    price_usdc: "100",
    released_at: null,
    scheduled_at: "2026-04-09T01:00:00.000Z",
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Disputed",
    timezone: "UTC",
    title: "Consultation",
    tx_hash: null,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getAdminDealReviewRowById = async () => makeReviewRow();
  mocks.getDealActionContextById = async () => makeActionContext();
  mocks.listDisputedDealReviewRows = async () => [makeReviewRow()];
});

describe("listAdminDisputedDeals", () => {
  test("returns only review models for disputed deals", async () => {
    const result = await listAdminDisputedDeals();

    assert.equal(result.length, 1);
    assert.equal(result[0].status, "Disputed");
    assert.equal(result[0].release_deadline_at, "2026-04-12T00:00:00.000Z");
  });
});

describe("getAdminDealReview", () => {
  test("rejects non-disputed deal context", async () => {
    mocks.getAdminDealReviewRowById = async () => makeReviewRow({ status: "Released" });

    await assert.rejects(
      () => getAdminDealReview({ dealId: "deal-id-1" }),
      (error: unknown) => {
        assert.ok(error instanceof DealAdminServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_NOT_DISPUTED");
        return true;
      },
    );
  });
});

describe("prepareAdminResolveForDeal", () => {
  test("prepares admin release call for disputed deal", async () => {
    const result = await prepareAdminResolveForDeal(
      { dealId: "deal-id-1" },
      "release",
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.resolution, "release");
    assert.equal(result.contract_call.function_name, "adminResolveRelease");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("prepares admin refund call for disputed deal", async () => {
    const result = await prepareAdminResolveForDeal(
      { dealId: "deal-id-1" },
      "refund",
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.resolution, "refund");
    assert.equal(result.contract_call.function_name, "adminResolveRefund");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("rejects resolve for non-disputed deal", async () => {
    mocks.getDealActionContextById = async () => makeActionContext({ status: "Funded" });

    await assert.rejects(
      () => prepareAdminResolveForDeal({ dealId: "deal-id-1" }, "release"),
      (error: unknown) => {
        assert.ok(error instanceof DealAdminServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_NOT_DISPUTED");
        return true;
      },
    );
  });
});
