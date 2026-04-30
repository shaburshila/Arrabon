import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type { MyBuyerDealRow } from "../../server/repositories/deals";
import {
  listMyBuyerDeals,
  MyDealsServiceError,
} from "../../server/services/my-deals";

interface MyDealsMocks {
  DealsRepositoryError: new (message: string, code?: string) => Error & { code?: string };
  getAllBuyerDealRows: (...args: unknown[]) => Promise<MyBuyerDealRow[]>;
  listBuyerDealRows: (...args: unknown[]) => Promise<MyBuyerDealRow[]>;
}

const mocks = (global as typeof globalThis & { __myDealsMocks: MyDealsMocks }).__myDealsMocks;

const BUYER_LOWER = "0x0000000000000000000000000000000000000002";
const BUYER_MIXED = "0x0000000000000000000000000000000000000002";

const currentUser: CurrentUserContext = {
  avatar_url: null,
  expires_at: "2026-04-18T00:00:00.000Z",
  id: "user-id-1",
  is_admin: false,
  username: null,
  wallet_address: BUYER_MIXED,
};

function makeRow(overrides: Partial<MyBuyerDealRow> = {}): MyBuyerDealRow {
  return {
    buyer_address: BUYER_LOWER,
    completed_at: null,
    consultation_link_id: "link-id-1",
    created_at: "2026-04-17T10:00:00.000Z",
    description: "Consultation description",
    duration_minutes: 60,
    id: "deal-id-1",
    onchain_deal_id: "42",
    price_usdc: "25.000000",
    released_at: null,
    resolution_type: null,
    resolved_at: null,
    resolved_from_status: null,
    scheduled_at: "2026-04-18T10:00:00.000Z",
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Funded",
    timezone: "UTC",
    title: "Paid consultation",
    tx_hash: "0x" + "a".repeat(64),
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getAllBuyerDealRows = async () => [];
  mocks.listBuyerDealRows = async () => [];
});

describe("listMyBuyerDeals", () => {
  test("returns an empty array when buyer has no deals", async () => {
    const result = await listMyBuyerDeals(currentUser);

    assert.deepEqual(result, []);
  });

  test("normalizes current wallet before loading buyer deals", async () => {
    let receivedBuyerAddress: unknown = null;
    mocks.getAllBuyerDealRows = async (buyerAddress) => {
      receivedBuyerAddress = buyerAddress;
      return [];
    };

    await listMyBuyerDeals(currentUser);

    assert.equal(receivedBuyerAddress, BUYER_LOWER);
  });

  test("does not pass pagination to the repository and slices in the service", async () => {
    let receivedArgs: unknown[] | null = null;
    mocks.getAllBuyerDealRows = async (...args) => {
      receivedArgs = args;
      return [
        makeRow({ id: "deal-id-1", onchain_deal_id: "41" }),
        makeRow({ id: "deal-id-2", onchain_deal_id: "42" }),
        makeRow({ id: "deal-id-3", onchain_deal_id: "43" }),
      ];
    };

    const result = await listMyBuyerDeals(currentUser, { limit: 1, offset: 1 });

    assert.deepEqual(receivedArgs, [BUYER_LOWER]);
    assert.deepEqual(result.map((deal) => deal.id), ["deal-id-2"]);
  });

  test("returns mapped buyer deal rows", async () => {
    mocks.getAllBuyerDealRows = async () => [
      makeRow({
        resolution_type: "admin_release",
        resolved_at: "2026-04-19T10:00:00.000Z",
        resolved_from_status: "Disputed",
        status: "Released",
      }),
    ];

    const result = await listMyBuyerDeals(currentUser);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "deal-id-1");
    assert.equal(result[0].title, "Paid consultation");
    assert.equal(result[0].price_usdc, "25.000000");
    assert.equal(result[0].status, "Released");
    assert.equal(result[0].resolution_type, "admin_release");
    assert.equal(result[0].resolved_from_status, "Disputed");
  });

  test("maps repository errors to service errors", async () => {
    mocks.getAllBuyerDealRows = async () => {
      throw new mocks.DealsRepositoryError("db down", "DB_DOWN");
    };

    await assert.rejects(
      () => listMyBuyerDeals(currentUser),
      (error: unknown) => {
        assert.ok(error instanceof MyDealsServiceError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "DB_DOWN");
        return true;
      },
    );
  });

  test("preserves consultation-link-missing as a specific service error", async () => {
    mocks.getAllBuyerDealRows = async () => {
      throw new mocks.DealsRepositoryError("missing link", "CONSULTATION_LINK_MISSING");
    };

    await assert.rejects(
      () => listMyBuyerDeals(currentUser),
      (error: unknown) => {
        assert.ok(error instanceof MyDealsServiceError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "CONSULTATION_LINK_MISSING");
        return true;
      },
    );
  });

  test("applies upcoming filter before pagination", async () => {
    mocks.getAllBuyerDealRows = async () => [
      makeRow({ id: "deal-resolved-1", onchain_deal_id: "51", status: "Released" }),
      makeRow({ id: "deal-resolved-2", onchain_deal_id: "52", status: "Refunded" }),
      makeRow({ id: "deal-upcoming-1", onchain_deal_id: "53", status: "Funded" }),
      makeRow({ id: "deal-upcoming-2", onchain_deal_id: "54", status: "Funded" }),
    ];

    const result = await listMyBuyerDeals(
      currentUser,
      { limit: 20, offset: 0 },
      "upcoming",
    );

    assert.deepEqual(result.map((deal) => deal.id), [
      "deal-upcoming-1",
      "deal-upcoming-2",
    ]);
  });

  test("returns only needs action deals for needs_action filter", async () => {
    mocks.getAllBuyerDealRows = async () => [
      makeRow({ id: "deal-upcoming", onchain_deal_id: "61", status: "Funded" }),
      makeRow({ id: "deal-needs-action", onchain_deal_id: "62", status: "ConfirmPending" }),
      makeRow({ id: "deal-disputed", onchain_deal_id: "63", status: "Disputed" }),
    ];

    const result = await listMyBuyerDeals(
      currentUser,
      undefined,
      "needs_action",
    );

    assert.deepEqual(result.map((deal) => deal.id), ["deal-needs-action"]);
  });

  test("returns only disputed deals for disputed filter", async () => {
    mocks.getAllBuyerDealRows = async () => [
      makeRow({ id: "deal-disputed", onchain_deal_id: "71", status: "Disputed" }),
      makeRow({ id: "deal-resolved", onchain_deal_id: "72", status: "Released" }),
    ];

    const result = await listMyBuyerDeals(
      currentUser,
      undefined,
      "disputed",
    );

    assert.deepEqual(result.map((deal) => deal.id), ["deal-disputed"]);
  });

  test("returns only resolved deals for resolved filter", async () => {
    mocks.getAllBuyerDealRows = async () => [
      makeRow({ id: "deal-released", onchain_deal_id: "81", status: "Released" }),
      makeRow({ id: "deal-refunded", onchain_deal_id: "82", status: "Refunded" }),
      makeRow({ id: "deal-fund", onchain_deal_id: "83", status: "Funded" }),
    ];

    const result = await listMyBuyerDeals(
      currentUser,
      undefined,
      "resolved",
    );

    assert.deepEqual(result.map((deal) => deal.id), ["deal-released", "deal-refunded"]);
  });
});
