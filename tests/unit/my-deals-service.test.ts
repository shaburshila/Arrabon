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
  mocks.listBuyerDealRows = async () => [];
});

describe("listMyBuyerDeals", () => {
  test("returns an empty array when buyer has no deals", async () => {
    const result = await listMyBuyerDeals(currentUser);

    assert.deepEqual(result, []);
  });

  test("normalizes current wallet before loading buyer deals", async () => {
    let receivedBuyerAddress: unknown = null;
    mocks.listBuyerDealRows = async (buyerAddress) => {
      receivedBuyerAddress = buyerAddress;
      return [];
    };

    await listMyBuyerDeals(currentUser);

    assert.equal(receivedBuyerAddress, BUYER_LOWER);
  });

  test("returns mapped buyer deal rows", async () => {
    mocks.listBuyerDealRows = async () => [
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
    mocks.listBuyerDealRows = async () => {
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
    mocks.listBuyerDealRows = async () => {
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
});
