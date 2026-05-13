import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { ConsultationLinkRow, DealRow } from "../../lib/db/types";
import {
  DealsRepositoryError,
  listActiveDealPayoutBlockTargetsByWallet,
  listBuyerDealRows,
  listDisputedDealReviewRows,
} from "../../server/repositories/deals";

interface DealsRepositoryMocks {
  calls: {
    dbFrom: unknown[];
    eq: unknown[];
    getById: unknown[];
    getByIds: unknown[];
    order: unknown[];
    or: unknown[];
    range: unknown[];
    schema: unknown[];
    select: unknown[];
  };
  dealsResult: {
    data: DealRow[];
    error: unknown;
  };
  getById: (...args: unknown[]) => Promise<ConsultationLinkRow | null>;
  getByIds: (...args: unknown[]) => Promise<ConsultationLinkRow[]>;
  reset: () => void;
}

const mocks = (global as typeof globalThis & { __dealsRepositoryMocks: DealsRepositoryMocks })
  .__dealsRepositoryMocks;

const BUYER_ADDRESS = "0x0000000000000000000000000000000000000002";

function makeDeal(overrides: Partial<DealRow> = {}): DealRow {
  return {
    buyer_address: BUYER_ADDRESS,
    completed_at: null,
    consultation_link_id: "link-id-1",
    created_at: "2026-04-17T10:00:00.000Z",
    funded_at: "2026-04-17T10:00:00.000Z",
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    risk_status: "Clear",
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Funded",
    tx_hash: "0x" + "a".repeat(64),
    ...overrides,
  };
}

function makeLink(overrides: Partial<ConsultationLinkRow> = {}): ConsultationLinkRow {
  return {
    created_at: "2026-04-16T10:00:00.000Z",
    creator_user_id: "user-id-1",
    description: "Consultation description",
    duration_minutes: 60,
    expert_address: "0x0000000000000000000000000000000000000001",
    expires_at: "2026-04-17T09:00:00.000Z",
    id: "link-id-1",
    link_hash: "0x" + "b".repeat(64),
    meeting_url_encrypted: "encrypted",
    price_usdc: "25.000000",
    scheduled_at: "2026-04-18T10:00:00.000Z",
    status: "Consumed",
    timezone: "UTC",
    title: "Paid consultation",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.reset();
});

describe("deals repository list rows", () => {
  test("loads buyer deal consultation links in one batch", async () => {
    const dealOne = makeDeal();
    const dealTwo = makeDeal({
      consultation_link_id: "link-id-2",
      created_at: "2026-04-17T09:00:00.000Z",
      id: "deal-id-2",
      onchain_deal_id: "43",
    });
    mocks.dealsResult = {
      data: [dealOne, dealTwo],
      error: null,
    };
    mocks.getByIds = async (...args) => {
      mocks.calls.getByIds.push(args);
      return [makeLink(), makeLink({ id: "link-id-2", title: "Second consultation" })];
    };

    const result = await listBuyerDealRows(BUYER_ADDRESS);

    assert.deepEqual(mocks.calls.getByIds, [[["link-id-1", "link-id-2"]]]);
    assert.deepEqual(mocks.calls.range, [[0, 49]]);
    assert.deepEqual(mocks.calls.getById, []);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "deal-id-1");
    assert.equal(result[0].title, "Paid consultation");
    assert.equal(result[1].id, "deal-id-2");
    assert.equal(result[1].title, "Second consultation");
  });

  test("loads disputed deal consultation links in one batch", async () => {
    const dealOne = makeDeal({ status: "Disputed" });
    const dealTwo = makeDeal({
      consultation_link_id: "link-id-2",
      id: "deal-id-2",
      onchain_deal_id: "43",
      status: "Disputed",
    });
    mocks.dealsResult = {
      data: [dealOne, dealTwo],
      error: null,
    };
    mocks.getByIds = async (...args) => {
      mocks.calls.getByIds.push(args);
      return [makeLink(), makeLink({ id: "link-id-2", title: "Second dispute" })];
    };

    const result = await listDisputedDealReviewRows();

    assert.deepEqual(mocks.calls.getByIds, [[["link-id-1", "link-id-2"]]]);
    assert.deepEqual(mocks.calls.range, [[0, 49]]);
    assert.deepEqual(mocks.calls.getById, []);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "deal-id-1");
    assert.equal(result[0].title, "Paid consultation");
    assert.equal(result[1].id, "deal-id-2");
    assert.equal(result[1].title, "Second dispute");
  });

  test("includes blocked confirm-pending deals in admin review rows but excludes funded and resolved blocked deals", async () => {
    mocks.dealsResult = {
      data: [
        makeDeal({ id: "deal-id-1", onchain_deal_id: "41", risk_status: "Clear", status: "Disputed" }),
        makeDeal({
          id: "deal-id-2",
          onchain_deal_id: "42",
          risk_status: "Blocked",
          status: "ConfirmPending",
        }),
      ],
      error: null,
    };
    mocks.getByIds = async (...args) => {
      mocks.calls.getByIds.push(args);
      return [
        makeLink({ id: "link-id-1", title: "Disputed consultation" }),
        makeLink({ id: "link-id-2", title: "Blocked confirm-pending consultation" }),
      ];
    };

    const result = await listDisputedDealReviewRows();

    assert.deepEqual(mocks.calls.or, [
      "status.eq.Disputed,and(status.eq.ConfirmPending,risk_status.eq.Blocked)",
    ]);
    assert.deepEqual(result.map((deal) => [deal.id, deal.status]), [
      ["deal-id-1", "Disputed"],
      ["deal-id-2", "ConfirmPending"],
    ]);
  });

  test("deduplicates consultation link ids before batch loading", async () => {
    mocks.dealsResult = {
      data: [
        makeDeal(),
        makeDeal({ id: "deal-id-2", onchain_deal_id: "43" }),
      ],
      error: null,
    };
    mocks.getByIds = async (...args) => {
      mocks.calls.getByIds.push(args);
      return [makeLink()];
    };

    await listBuyerDealRows(BUYER_ADDRESS);

    assert.deepEqual(mocks.calls.getByIds, [[["link-id-1"]]]);
  });

  test("does not batch load consultation links for an empty buyer deal list", async () => {
    mocks.dealsResult = {
      data: [],
      error: null,
    };

    const result = await listBuyerDealRows(BUYER_ADDRESS);

    assert.deepEqual(result, []);
    assert.deepEqual(mocks.calls.range, [[0, 49]]);
    assert.deepEqual(mocks.calls.getByIds, []);
    assert.deepEqual(mocks.calls.getById, []);
  });

  test("applies custom pagination range to buyer deal list", async () => {
    mocks.dealsResult = {
      data: [],
      error: null,
    };

    await listBuyerDealRows(BUYER_ADDRESS, { limit: 25, offset: 50 });

    assert.deepEqual(mocks.calls.range, [[50, 74]]);
  });

  test("applies custom pagination range to disputed deal list", async () => {
    mocks.dealsResult = {
      data: [],
      error: null,
    };

    await listDisputedDealReviewRows({ limit: 10, offset: 20 });

    assert.deepEqual(mocks.calls.range, [[20, 29]]);
  });

  test("preserves consultation-link-missing errors after batch loading", async () => {
    mocks.dealsResult = {
      data: [makeDeal()],
      error: null,
    };
    mocks.getByIds = async (...args) => {
      mocks.calls.getByIds.push(args);
      return [];
    };

    await assert.rejects(
      () => listBuyerDealRows(BUYER_ADDRESS),
      (error) => {
        assert.ok(error instanceof DealsRepositoryError);
        assert.equal(error.code, "CONSULTATION_LINK_MISSING");
        return true;
      },
    );
  });

  test("returns only active payout block targets for a wallet", async () => {
    mocks.dealsResult = {
      data: [
        makeDeal({
          buyer_address: "0x0000000000000000000000000000000000000002",
          id: "deal-id-1",
          onchain_deal_id: "41",
          seller_address: "0x000000000000000000000000000000000000000A",
          status: "Funded",
        }),
        makeDeal({ id: "deal-id-2", onchain_deal_id: "42", status: "ConfirmPending" }),
        makeDeal({
          id: "deal-id-3",
          onchain_deal_id: "43",
          seller_address: "0x0000000000000000000000000000000000000002",
          status: "Disputed",
        }),
        makeDeal({ id: "deal-id-4", onchain_deal_id: "44", status: "Released" }),
      ],
      error: null,
    };

    const result = await listActiveDealPayoutBlockTargetsByWallet(BUYER_ADDRESS);

    assert.deepEqual(mocks.calls.or, [
      `buyer_address.ilike.${BUYER_ADDRESS},seller_address.ilike.${BUYER_ADDRESS}`,
    ]);
    assert.deepEqual(result, [
      { id: "deal-id-1", onchain_deal_id: "41" },
      { id: "deal-id-2", onchain_deal_id: "42" },
      { id: "deal-id-3", onchain_deal_id: "43" },
    ]);
  });
});
