import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type { DealActionContextRow } from "../../server/repositories/deals";
import {
  DealCompletionServiceError,
  prepareConfirmReleaseForDeal,
  prepareOpenDisputeForDeal,
} from "../../server/services/deals-completion";

interface DealsCompletionMocks {
  getDealActionContextById: (...args: unknown[]) => Promise<DealActionContextRow | null>;
}

const mocks = (global as typeof globalThis & { __dealsCompletionMocks: DealsCompletionMocks }).__dealsCompletionMocks;

const BUYER = "0x0000000000000000000000000000000000000002";
const SELLER = "0x0000000000000000000000000000000000000001";
const COMPLETED_AT = "2026-04-10T00:00:00.000Z";
const DEADLINE = new Date("2026-04-12T00:00:00.000Z");

const currentUser: CurrentUserContext = {
  avatar_url: null,
  expires_at: "2026-04-12T12:00:00.000Z",
  id: "user-id-1",
  is_admin: false,
  username: null,
  wallet_address: BUYER,
};

function makeContext(overrides: Partial<DealActionContextRow> = {}): DealActionContextRow {
  return {
    buyer_address: BUYER,
    completed_at: COMPLETED_AT,
    consultation_link_id: "link-id-1",
    duration_minutes: 30,
    grace_period_minutes: 0,
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    scheduled_at: "2026-04-09T00:00:00.000Z",
    seller_address: SELLER,
    status: "ConfirmPending",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.getDealActionContextById = async () => makeContext();
});

describe("prepareConfirmReleaseForDeal deadline boundary", () => {
  test("allows confirm release at the exact 48h deadline", async () => {
    const result = await prepareConfirmReleaseForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      DEADLINE,
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "confirmRelease");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("rejects confirm release after the 48h deadline", async () => {
    await assert.rejects(
      () => prepareConfirmReleaseForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        new Date(DEADLINE.getTime() + 1),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "RELEASE_DEADLINE_PASSED");
        return true;
      },
    );
  });
});

describe("prepareOpenDisputeForDeal deadline boundary", () => {
  test("allows open dispute at the exact 48h deadline", async () => {
    const result = await prepareOpenDisputeForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      DEADLINE,
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "openDispute");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("rejects open dispute after the 48h deadline", async () => {
    await assert.rejects(
      () => prepareOpenDisputeForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        new Date(DEADLINE.getTime() + 1),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DISPUTE_WINDOW_CLOSED");
        return true;
      },
    );
  });
});
