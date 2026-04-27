import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type { DealActionContextRow } from "../../server/repositories/deals";
import {
  DealCompletionServiceError,
  prepareAutoReleaseForDeal,
  prepareConfirmReleaseForDeal,
  prepareMarkCompletedForDeal,
  prepareOpenDisputeForDeal,
} from "../../server/services/deals-completion";

interface DealsCompletionMocks {
  assertCompliance: (...args: unknown[]) => unknown;
  getDealActionContextById: (...args: unknown[]) => Promise<DealActionContextRow | null>;
  screenWalletForDeal: (...args: unknown[]) => Promise<unknown>;
}

const mocks = (global as typeof globalThis & { __dealsCompletionMocks: DealsCompletionMocks }).__dealsCompletionMocks;

const BUYER = "0x0000000000000000000000000000000000000002";
const SELLER = "0x0000000000000000000000000000000000000001";
const COMPLETED_AT = "2026-04-10T00:00:00.000Z";
const DEADLINE = new Date("2026-04-12T00:00:00.000Z");
const SCHEDULED_AT = "2026-04-09T00:00:00.000Z";

const currentUser: CurrentUserContext = {
  avatar_url: null,
  expires_at: "2026-04-12T12:00:00.000Z",
  id: "user-id-1",
  is_admin: false,
  username: null,
  wallet_address: BUYER,
};

const sellerUser: CurrentUserContext = {
  ...currentUser,
  id: "user-id-2",
  wallet_address: SELLER,
};

const adminUser: CurrentUserContext = {
  ...currentUser,
  id: "admin-id-1",
  is_admin: true,
  wallet_address: "0x0000000000000000000000000000000000000003",
};

function makeContext(overrides: Partial<DealActionContextRow> = {}): DealActionContextRow {
  return {
    buyer_address: BUYER,
    completed_at: COMPLETED_AT,
    consultation_link_id: "link-id-1",
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    scheduled_at: SCHEDULED_AT,
    seller_address: SELLER,
    status: "ConfirmPending",
    ...overrides,
  };
}

function makeScreeningResult(overrides: Record<string, unknown> = {}) {
  return {
    normalizedWallet: SELLER.toLowerCase(),
    provider: "local_denylist",
    rawSummary: {},
    reasonCode: "NO_HIT",
    result: "Clear",
    walletAddress: SELLER,
    ...overrides,
  };
}

beforeEach(() => {
  mocks.assertCompliance = () => {};
  mocks.getDealActionContextById = async () => makeContext();
  mocks.screenWalletForDeal = async () => makeScreeningResult();
});

describe("prepareMarkCompletedForDeal availability", () => {
  test("allows seller to mark a funded deal completed immediately", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    const result = await prepareMarkCompletedForDeal(
      { ...currentUser, wallet_address: SELLER },
      { dealId: "deal-id-1" },
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "markCompleted");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("screens seller with lifecycle_complete context before preparing call", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    let screenedWallet: unknown = null;
    let screenedContext: unknown = null;
    let assertedResult: unknown = null;
    let assertedWallet: unknown = null;
    let assertedContext: unknown = null;

    mocks.screenWalletForDeal = async (...args: unknown[]) => {
      [screenedWallet, screenedContext] = args;
      return makeScreeningResult();
    };
    mocks.assertCompliance = (...args: unknown[]) => {
      [assertedResult, assertedWallet, assertedContext] = args;
    };

    await prepareMarkCompletedForDeal(
      { ...currentUser, wallet_address: SELLER },
      { dealId: "deal-id-1" },
    );

    assert.equal(screenedWallet, SELLER);
    assert.deepEqual(screenedContext, {
      action: "lifecycle_complete",
      actorWallet: SELLER,
      dealId: "deal-id-1",
    });
    assert.deepEqual(assertedResult, makeScreeningResult());
    assert.equal(assertedWallet, SELLER);
    assert.deepEqual(assertedContext, screenedContext);
  });

  test("stops before preparing call when compliance blocks seller", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    let prepareCalls = 0;
    mocks.assertCompliance = () => {
      throw new Error("blocked");
    };
    (mocks as typeof mocks & { prepareMarkCompletedCall: (dealId: unknown) => unknown }).prepareMarkCompletedCall =
      (dealId: unknown) => {
        prepareCalls += 1;
        return {
          args: { deal_id: dealId },
          chain_id: 8453,
          contract_address: "0x0000000000000000000000000000000000000001",
          function_name: "markCompleted",
        };
      };

    await assert.rejects(
      () =>
        prepareMarkCompletedForDeal(
          { ...currentUser, wallet_address: SELLER },
          { dealId: "deal-id-1" },
        ),
      /blocked/,
    );
    assert.equal(prepareCalls, 0);
  });
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

  test("screens seller while keeping buyer as actor", async () => {
    let screenedWallet: unknown = null;
    let screenedContext: unknown = null;

    mocks.screenWalletForDeal = async (...args: unknown[]) => {
      [screenedWallet, screenedContext] = args;
      return makeScreeningResult();
    };

    await prepareConfirmReleaseForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      DEADLINE,
    );

    assert.equal(screenedWallet, SELLER);
    assert.deepEqual(screenedContext, {
      action: "lifecycle_release",
      actorWallet: BUYER,
      dealId: "deal-id-1",
    });
  });
});

describe("prepareOpenDisputeForDeal deadline boundary", () => {
  test("does not invoke compliance screening for dispute", async () => {
    let complianceCalls = 0;

    mocks.screenWalletForDeal = async () => {
      complianceCalls += 1;
      return makeScreeningResult();
    };

    await prepareOpenDisputeForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      DEADLINE,
    );

    assert.equal(complianceCalls, 0);
  });

  test("rejects funded dispute before scheduled_at", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    await assert.rejects(
      () => prepareOpenDisputeForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        new Date(new Date(SCHEDULED_AT).getTime() - 1),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "FUNDED_DISPUTE_NOT_AVAILABLE");
        return true;
      },
    );
  });

  test("allows funded dispute at scheduled_at", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    const result = await prepareOpenDisputeForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      new Date(SCHEDULED_AT),
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "openDispute");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("allows funded dispute after scheduled_at", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    const result = await prepareOpenDisputeForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      new Date(new Date(SCHEDULED_AT).getTime() + 1),
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "openDispute");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("rejects funded dispute when scheduled_at is invalid", async () => {
    mocks.getDealActionContextById = async () => makeContext({
      scheduled_at: "invalid-date",
      status: "Funded",
    });

    await assert.rejects(
      () => prepareOpenDisputeForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        new Date(SCHEDULED_AT),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "SCHEDULED_AT_INVALID");
        return true;
      },
    );
  });

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

describe("prepareAutoReleaseForDeal deadline boundary", () => {
  test("rejects auto-release at the exact 48h deadline", async () => {
    await assert.rejects(
      () => prepareAutoReleaseForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        DEADLINE,
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "AUTO_RELEASE_NOT_AVAILABLE");
        return true;
      },
    );
  });

  test("allows auto-release strictly after the 48h deadline", async () => {
    const result = await prepareAutoReleaseForDeal(
      currentUser,
      { dealId: "deal-id-1" },
      new Date(DEADLINE.getTime() + 1),
    );

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.contract_call.function_name, "autoRelease");
    assert.equal(result.contract_call.args.deal_id, "42");
  });

  test("screens seller while keeping current user as actor", async () => {
    let screenedWallet: unknown = null;
    let screenedContext: unknown = null;

    mocks.screenWalletForDeal = async (...args: unknown[]) => {
      [screenedWallet, screenedContext] = args;
      return makeScreeningResult();
    };

    await prepareAutoReleaseForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      new Date(DEADLINE.getTime() + 1),
    );

    assert.equal(screenedWallet, SELLER);
    assert.deepEqual(screenedContext, {
      action: "lifecycle_auto_release",
      actorWallet: adminUser.wallet_address,
      dealId: "deal-id-1",
    });
  });

  test("rejects auto-release for non-confirm-pending deals", async () => {
    mocks.getDealActionContextById = async () => makeContext({ status: "Funded" });

    await assert.rejects(
      () => prepareAutoReleaseForDeal(
        currentUser,
        { dealId: "deal-id-1" },
        new Date(DEADLINE.getTime() + 1),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_NOT_CONFIRM_PENDING");
        return true;
      },
    );
  });

  test("allows the seller to prepare auto-release", async () => {
    const result = await prepareAutoReleaseForDeal(
      sellerUser,
      { dealId: "deal-id-1" },
      new Date(DEADLINE.getTime() + 1),
    );

    assert.equal(result.contract_call.function_name, "autoRelease");
  });

  test("allows an admin to prepare auto-release", async () => {
    const result = await prepareAutoReleaseForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      new Date(DEADLINE.getTime() + 1),
    );

    assert.equal(result.contract_call.function_name, "autoRelease");
  });

  test("rejects auto-release for a non-participant", async () => {
    await assert.rejects(
      () => prepareAutoReleaseForDeal(
        {
          ...currentUser,
          wallet_address: "0x0000000000000000000000000000000000000004",
        },
        { dealId: "deal-id-1" },
        new Date(DEADLINE.getTime() + 1),
      ),
      (error: unknown) => {
        assert.ok(error instanceof DealCompletionServiceError);
        assert.equal(error.status, 403);
        assert.equal(error.code, "NOT_DEAL_PARTICIPANT");
        return true;
      },
    );
  });
});
