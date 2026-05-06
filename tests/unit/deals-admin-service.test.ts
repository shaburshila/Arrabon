import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";

import type { CurrentUserContext } from "../../lib/auth/guards";
import type {
  AdminDealReviewRow,
  DealActionContextRow,
} from "../../server/repositories/deals";
import {
  DealAdminServiceError,
  exchangeAdminResolveGrantForDeal,
  getAdminDealCompliance,
  getAdminDealReview,
  listAdminDisputedDeals,
  prepareAdminResolveForDeal,
} from "../../server/services/deals-admin";

interface DealsAdminMocks {
  assertDealNotBlocked: (...args: unknown[]) => Promise<unknown>;
  ConsultEscrowConfigError: new (message: string) => Error;
  assertCompliance: (...args: unknown[]) => unknown;
  createAdminResolutionIntent: (...args: unknown[]) => Promise<unknown>;
  createPayoutExecutionGrant: (...args: unknown[]) => Promise<unknown>;
  consumePayoutExecutionGrant: (...args: unknown[]) => Promise<unknown>;
  findByDealNewestFirst: (...args: unknown[]) => Promise<unknown[]>;
  getAdminDealReviewRowById: (...args: unknown[]) => Promise<AdminDealReviewRow | null>;
  getDealActionContextById: (...args: unknown[]) => Promise<DealActionContextRow | null>;
  listDisputedDealReviewRows: (...args: unknown[]) => Promise<AdminDealReviewRow[]>;
  screenWalletForDeal: (...args: unknown[]) => Promise<unknown>;
  prepareAdminResolveReleaseCall: (...args: unknown[]) => unknown;
}

const mocks = (global as typeof globalThis & { __dealsAdminMocks: DealsAdminMocks }).__dealsAdminMocks;
const ADMIN_WALLET = "0x0000000000000000000000000000000000000003";

const adminUser: CurrentUserContext = {
  avatar_url: null,
  expires_at: "2026-04-12T12:00:00.000Z",
  id: "admin-id-1",
  is_admin: true,
  username: null,
  wallet_address: ADMIN_WALLET,
};

function makeActionContext(
  overrides: Partial<DealActionContextRow> = {},
): DealActionContextRow {
  return {
    buyer_address: "0x0000000000000000000000000000000000000002",
    completed_at: "2026-04-10T00:00:00.000Z",
    consultation_link_id: "link-id-1",
    duration_minutes: 60,
    id: "deal-id-1",
    onchain_deal_id: "42",
    released_at: null,
    risk_status: "Clear",
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
    risk_status: "Clear",
    resolution_type: null,
    resolved_at: null,
    resolved_by_wallet: null,
    resolved_from_status: null,
    scheduled_at: "2026-04-09T01:00:00.000Z",
    seller_address: "0x0000000000000000000000000000000000000001",
    status: "Disputed",
    timezone: "UTC",
    title: "Consultation",
    tx_hash: null,
    ...overrides,
  };
}

function makeScreeningResult(walletAddress: string) {
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "local_denylist",
    rawSummary: {},
    reasonCode: "NO_HIT",
    result: "Clear",
    walletAddress,
  };
}

beforeEach(() => {
  mocks.assertDealNotBlocked = async () => undefined;
  mocks.assertCompliance = () => {};
  mocks.createAdminResolutionIntent = async () => ({ id: "intent-id-1" });
  mocks.findByDealNewestFirst = async () => [];
  mocks.getAdminDealReviewRowById = async () => makeReviewRow();
  mocks.getDealActionContextById = async () => makeActionContext();
  mocks.listDisputedDealReviewRows = async () => [makeReviewRow()];
  mocks.screenWalletForDeal = async (walletAddress: unknown) =>
    makeScreeningResult(String(walletAddress));
  mocks.prepareAdminResolveReleaseCall = (dealId: unknown) => ({
    chain_id: 8453,
    contract_address: "0x0000000000000000000000000000000000000001",
    data: `0x${String(dealId).padStart(64, "0")}`,
    function_name: "adminResolveRelease",
  });
});

describe("listAdminDisputedDeals", () => {
  test("returns only review models for disputed deals", async () => {
    const result = await listAdminDisputedDeals();

    assert.equal(result.length, 1);
    assert.equal(result[0].status, "Disputed");
    assert.equal(result[0].release_deadline_at, "2026-04-11T02:00:00.000Z");
  });

  test("passes pagination options to the repository", async () => {
    let receivedPagination: unknown = null;
    mocks.listDisputedDealReviewRows = async (pagination) => {
      receivedPagination = pagination;
      return [makeReviewRow()];
    };

    await listAdminDisputedDeals({ limit: 10, offset: 20 });

    assert.deepEqual(receivedPagination, { limit: 10, offset: 20 });
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

  test("returns risk status and fixed compliance summary shape", async () => {
    mocks.getAdminDealReviewRowById = async () => makeReviewRow({ risk_status: "Blocked" });
    mocks.findByDealNewestFirst = async () => [
      {
        actor_wallet: null,
        checked_at: "2026-04-27T02:00:00.000Z",
        deal_id: "deal-id-1",
        id: "check-2",
        provider: "chainalysis_sanctions_oracle",
        raw_summary: {},
        reason_code: "OFAC_SANCTIONS",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: "0xbuyer",
      },
      {
        actor_wallet: null,
        checked_at: "2026-04-27T01:00:00.000Z",
        deal_id: "deal-id-1",
        id: "check-1",
        provider: "local_denylist",
        raw_summary: {},
        reason_code: "LOCAL_DENYLIST",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: "0xseller",
      },
    ];

    const result = await getAdminDealReview({ dealId: "deal-id-1" });

    assert.equal(result.risk_status, "Blocked");
    assert.deepEqual(result.compliance_summary, {
      checks_count: 2,
      deal_id: "deal-id-1",
      providers: [
        {
          last_checked_at: "2026-04-27T02:00:00.000Z",
          latest_reason_code: "OFAC_SANCTIONS",
          latest_result: "Blocked",
          provider: "chainalysis_sanctions_oracle",
        },
        {
          last_checked_at: null,
          latest_reason_code: null,
          latest_result: null,
          provider: "usdc_blacklist",
        },
        {
          last_checked_at: "2026-04-27T01:00:00.000Z",
          latest_reason_code: "LOCAL_DENYLIST",
          latest_result: "Blocked",
          provider: "local_denylist",
        },
      ],
      risk_status: "Blocked",
      wallets: ["0xbuyer", "0xseller"],
    });
  });
});

describe("getAdminDealCompliance", () => {
  test("returns checks in newest-first order with shared summary", async () => {
    mocks.findByDealNewestFirst = async () => [
      {
        actor_wallet: null,
        checked_at: "2026-04-27T02:00:00.000Z",
        deal_id: "deal-id-1",
        id: "check-2",
        provider: "usdc_blacklist",
        raw_summary: {},
        reason_code: "USDC_BLACKLISTED",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: "0xbuyer",
      },
    ];

    const result = await getAdminDealCompliance({ dealId: "deal-id-1" });

    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.risk_status, "Clear");
    assert.equal(result.checks.length, 1);
    assert.equal(result.checks[0].id, "check-2");
    assert.equal(result.compliance_summary.providers[1].provider, "usdc_blacklist");
    assert.equal(result.compliance_summary.providers[1].latest_result, "Blocked");
  });
});

describe("prepareAdminResolveForDeal", () => {
  test("issues admin release grant for disputed deal", async () => {
    const result = await prepareAdminResolveForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "release",
    );

    assert.equal(result.action, "adminResolveRelease");
    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.resolution, "release");
    assert.match(result.grant_token, /^[0-9a-f]{64}$/);
  });

  test("does not screen release recipient during grant issuance", async () => {
    let screeningCalls = 0;

    mocks.screenWalletForDeal = async () => {
      screeningCalls += 1;
      return makeScreeningResult(makeActionContext().seller_address);
    };

    await prepareAdminResolveForDeal(adminUser, { dealId: "deal-id-1" }, "release");

    assert.equal(screeningCalls, 0);
  });

  test("stores admin grant for the authenticated admin wallet", async () => {
    let capturedInput: unknown = null;

    mocks.createPayoutExecutionGrant = async (...args: unknown[]) => {
      [capturedInput] = args;
      return { id: "grant-id-1" };
    };

    const result = await prepareAdminResolveForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "release",
    );

    assert.equal(result.action, "adminResolveRelease");
    assert.deepEqual(capturedInput, {
      action: "adminResolveRelease",
      dealId: "deal-id-1",
      expiresAt: result.expires_at,
      issuedByWallet: ADMIN_WALLET,
      issuedToWallet: ADMIN_WALLET,
      resolution: "release",
      tokenHash: String(capturedInput && (capturedInput as { tokenHash?: string }).tokenHash),
    });
    assert.match(String((capturedInput as { tokenHash?: string }).tokenHash), /^[0-9a-f]{64}$/);
  });

  test("issues admin refund grant for disputed deal", async () => {
    const result = await prepareAdminResolveForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "refund",
    );

    assert.equal(result.action, "adminResolveRefund");
    assert.equal(result.deal_id, "deal-id-1");
    assert.equal(result.resolution, "refund");
    assert.match(result.grant_token, /^[0-9a-f]{64}$/);
  });

  test("exchange screens seller for release with admin as actor", async () => {
    const screenedCalls: Array<{ context: unknown; wallet: unknown }> = [];

    mocks.screenWalletForDeal = async (...args: unknown[]) => {
      const [wallet, context] = args;
      screenedCalls.push({ context, wallet });
      return makeScreeningResult(String(wallet));
    };

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRelease");
    assert.equal(result.resolution, "release");
    assert.deepEqual(screenedCalls, [
      {
        context: {
          action: "admin_resolve_release",
          actorWallet: ADMIN_WALLET,
          dealId: "deal-id-1",
        },
        wallet: makeActionContext().seller_address,
      },
      {
        context: {
          action: "admin_resolve_refund",
          actorWallet: ADMIN_WALLET,
          dealId: "deal-id-1",
        },
        wallet: makeActionContext().buyer_address,
      },
    ]);
  });

  test("exchange screens buyer for refund with admin as actor", async () => {
    let screenedWallet: unknown = null;
    let screenedContext: unknown = null;

    mocks.consumePayoutExecutionGrant = async () => ({
      action: "adminResolveRefund",
      created_at: "2026-05-05T00:00:00.000Z",
      deal_id: "deal-id-1",
      expires_at: "2026-05-05T00:02:00.000Z",
      id: "grant-id-1",
      issued_by_wallet: ADMIN_WALLET,
      issued_to_wallet: ADMIN_WALLET,
      resolution: "refund",
      token_hash: "token-hash",
      used_at: "2026-05-05T00:01:00.000Z",
    });
    mocks.screenWalletForDeal = async (...args: unknown[]) => {
      [screenedWallet, screenedContext] = args;
      return makeScreeningResult(makeActionContext().buyer_address);
    };

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRefund");
    assert.equal(result.resolution, "refund");
    assert.equal(screenedWallet, makeActionContext().buyer_address);
    assert.deepEqual(screenedContext, {
      action: "admin_resolve_refund",
      actorWallet: ADMIN_WALLET,
      dealId: "deal-id-1",
    });
  });

  test("rejects resolve for non-disputed deal", async () => {
    let intentCalls = 0;

    mocks.getDealActionContextById = async () => makeActionContext({ status: "Funded" });
    mocks.createAdminResolutionIntent = async () => {
      intentCalls += 1;
      return { id: "intent-id-1" };
    };

    await assert.rejects(
      () => prepareAdminResolveForDeal(adminUser, { dealId: "deal-id-1" }, "release"),
      (error: unknown) => {
        assert.ok(error instanceof DealAdminServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "DEAL_NOT_DISPUTED");
        return true;
      },
    );
    assert.equal(intentCalls, 0);
  });

  test("creates admin release intent only on exchange", async () => {
    let capturedInput: unknown = null;

    mocks.consumePayoutExecutionGrant = async () => ({
      action: "adminResolveRelease",
      created_at: "2026-05-05T00:00:00.000Z",
      deal_id: "deal-id-1",
      expires_at: "2026-05-05T00:02:00.000Z",
      id: "grant-id-1",
      issued_by_wallet: ADMIN_WALLET,
      issued_to_wallet: ADMIN_WALLET,
      resolution: "release",
      token_hash: "token-hash",
      used_at: "2026-05-05T00:01:00.000Z",
    });
    mocks.createAdminResolutionIntent = async (...args: unknown[]) => {
      capturedInput = args[0];
      return { id: "intent-id-1" };
    };

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRelease");
    assert.deepEqual(capturedInput, {
      adminWallet: ADMIN_WALLET,
      dealId: "deal-id-1",
      onchainDealId: "42",
      resolution: "release",
    });
  });

  test("creates admin refund intent only on exchange", async () => {
    let capturedInput: unknown = null;

    mocks.createAdminResolutionIntent = async (...args: unknown[]) => {
      capturedInput = args[0];
      return { id: "intent-id-1" };
    };

    mocks.consumePayoutExecutionGrant = async () => ({
      action: "adminResolveRefund",
      created_at: "2026-05-05T00:00:00.000Z",
      deal_id: "deal-id-1",
      expires_at: "2026-05-05T00:02:00.000Z",
      id: "grant-id-1",
      issued_by_wallet: ADMIN_WALLET,
      issued_to_wallet: ADMIN_WALLET,
      resolution: "refund",
      token_hash: "token-hash",
      used_at: "2026-05-05T00:01:00.000Z",
    });

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRefund");
    assert.deepEqual(capturedInput, {
      adminWallet: ADMIN_WALLET,
      dealId: "deal-id-1",
      onchainDealId: "42",
      resolution: "refund",
    });
  });

  test("does not create intent when contract config is unavailable", async () => {
    let intentCalls = 0;

    mocks.consumePayoutExecutionGrant = async () => ({
      action: "adminResolveRelease",
      created_at: "2026-05-05T00:00:00.000Z",
      deal_id: "deal-id-1",
      expires_at: "2026-05-05T00:02:00.000Z",
      id: "grant-id-1",
      issued_by_wallet: ADMIN_WALLET,
      issued_to_wallet: ADMIN_WALLET,
      resolution: "release",
      token_hash: "token-hash",
      used_at: "2026-05-05T00:01:00.000Z",
    });
    mocks.prepareAdminResolveReleaseCall = () => {
      throw new mocks.ConsultEscrowConfigError("Missing contract config.");
    };
    mocks.createAdminResolutionIntent = async () => {
      intentCalls += 1;
      return { id: "intent-id-1" };
    };

    await assert.rejects(
      () => exchangeAdminResolveGrantForDeal(adminUser, { dealId: "deal-id-1" }, "a".repeat(64)),
      (error: unknown) => {
        assert.ok(error instanceof DealAdminServiceError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "CONTRACT_CONFIG_UNAVAILABLE");
        return true;
      },
    );
    assert.equal(intentCalls, 0);
  });

  test("allows admin resolve even when live recipient screening is blocked", async () => {
    let intentCalls = 0;

    mocks.screenWalletForDeal = async (walletAddress: unknown) => ({
      ...makeScreeningResult(String(walletAddress)),
      provider: "chainalysis_sanctions_oracle",
      reasonCode: "OFAC_SANCTIONS",
      result: "Blocked",
    });
    mocks.createAdminResolutionIntent = async () => {
      intentCalls += 1;
      return { id: "intent-id-1" };
    };

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRelease");
    assert.equal(intentCalls, 1);
  });

  test("allows admin resolve for legal-hold deals", async () => {
    let complianceCalls = 0;
    let intentCalls = 0;

    mocks.getDealActionContextById = async () => makeActionContext({ risk_status: "Blocked" });
    mocks.screenWalletForDeal = async () => {
      complianceCalls += 1;
      return makeScreeningResult(makeActionContext().seller_address);
    };
    mocks.createAdminResolutionIntent = async () => {
      intentCalls += 1;
      return { id: "intent-id-1" };
    };

    const result = await exchangeAdminResolveGrantForDeal(
      adminUser,
      { dealId: "deal-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.contract_call.function_name, "adminResolveRelease");
    assert.equal(complianceCalls, 2);
    assert.equal(intentCalls, 1);
  });

  test("rejects exchange when grant token is malformed", async () => {
    await assert.rejects(
      () => exchangeAdminResolveGrantForDeal(adminUser, { dealId: "deal-id-1" }, "bad"),
      (error: unknown) => {
        assert.ok(error instanceof DealAdminServiceError);
        assert.equal(error.status, 409);
        assert.equal(error.code, "PAYOUT_GRANT_INVALID");
        return true;
      },
    );
  });
});
