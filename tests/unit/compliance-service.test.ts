import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";

import type { ComplianceCheckRow, DealRow } from "@/lib/db/types";
import {
  assertDealNotBlocked,
  ComplianceServiceError,
  processPendingDealRiskRecomputeSweeps,
  recomputeDealRiskStatus,
  screenWalletForDeal,
  screenWalletsBatch,
} from "@/server/services/compliance";

interface ComplianceServiceMocks {
  calls: {
    createComplianceCheck: Array<Record<string, unknown>>;
    enqueueDealRiskRecomputeRequest: Array<Record<string, unknown>>;
    getById: string[];
    listPendingDealRiskRecomputeRequests: unknown[][];
    markDealRiskRecomputeRequestApplied: unknown[][];
    markDealRiskRecomputeRequestAppliedByDealSource: Array<Record<string, unknown>>;
    markDealRiskRecomputeRequestFailure: unknown[][];
    monitoringEvents: Array<Record<string, unknown>>;
    providerUnavailableEvents: Array<Record<string, unknown>>;
    updateRiskStatusById: Array<[string, DealRow["risk_status"]]>;
  };
  createComplianceCheck: (...args: unknown[]) => Promise<unknown>;
  enqueueDealRiskRecomputeRequest: (...args: unknown[]) => Promise<void>;
  findBlockedByDeal: (...args: unknown[]) => Promise<ComplianceCheckRow[]>;
  findByDeal: (...args: unknown[]) => Promise<ComplianceCheckRow[]>;
  getById: (...args: unknown[]) => Promise<DealRow | null>;
  listPendingDealRiskRecomputeRequests: (...args: unknown[]) => Promise<unknown[]>;
  markDealRiskRecomputeRequestApplied: (...args: unknown[]) => Promise<void>;
  markDealRiskRecomputeRequestAppliedByDealSource: (...args: unknown[]) => Promise<void>;
  markDealRiskRecomputeRequestFailure: (...args: unknown[]) => Promise<void>;
  provider: {
    id: "composite";
    screenWallet: (address: string) => Promise<unknown>;
  };
  reset: () => void;
  updateRiskStatusById: (...args: unknown[]) => Promise<DealRow>;
}

const mocks = (
  global as typeof globalThis & { __complianceServiceMocks: ComplianceServiceMocks }
).__complianceServiceMocks;

const BUYER = getAddress("0x00000000000000000000000000000000000000AA");
const SELLER = getAddress("0x00000000000000000000000000000000000000BB");

function makeProviderResult(
  provider: "chainalysis_sanctions_oracle" | "usdc_blacklist" | "local_denylist",
  overrides: Partial<Record<string, unknown>> = {},
) {
  const walletAddress = overrides.walletAddress ?? BUYER;
  const normalizedWallet =
    typeof overrides.normalizedWallet === "string"
      ? overrides.normalizedWallet
      : String(walletAddress).toLowerCase();

  return {
    normalizedWallet,
    provider,
    rawSummary: (overrides.rawSummary as Record<string, unknown> | undefined) ?? { provider },
    reasonCode: (overrides.reasonCode as string | undefined) ?? "NO_HIT",
    result: (overrides.result as string | undefined) ?? "Clear",
    walletAddress,
  };
}

function makeCompositeResult(
  providerResults: ReturnType<typeof makeProviderResult>[],
  overrides: Partial<Record<string, unknown>> = {},
) {
  return {
    normalizedWallet:
      typeof overrides.normalizedWallet === "string"
        ? overrides.normalizedWallet
        : String(overrides.walletAddress ?? BUYER).toLowerCase(),
    provider: (overrides.provider as string | null | undefined) ?? null,
    rawSummary: {
      providerResults,
      results: providerResults,
      ...(overrides.rawSummary as Record<string, unknown> | undefined),
    },
    reasonCode: (overrides.reasonCode as string | undefined) ?? "NO_HIT",
    result: (overrides.result as string | undefined) ?? "Clear",
    walletAddress: (overrides.walletAddress as `0x${string}` | undefined) ?? BUYER,
  };
}

function makeCheck(
  result: ComplianceCheckRow["result"],
  reasonCode: ComplianceCheckRow["reason_code"],
): ComplianceCheckRow {
  return {
    id: `${result}-${reasonCode}`,
    actor_wallet: BUYER.toLowerCase(),
    checked_at: "2026-04-27T00:00:00.000Z",
    deal_id: "deal-id-1",
    provider: "chainalysis_sanctions_oracle",
    raw_summary: { reasonCode },
    reason_code: reasonCode,
    result,
    subject_type: "wallet",
    subject_value: BUYER.toLowerCase(),
  };
}

beforeEach(() => {
  mocks.reset();
});

describe("screenWalletForDeal", () => {
  test("writes exactly three provider-level checks and never writes provider=composite", async () => {
    const providerResults = [
      makeProviderResult("chainalysis_sanctions_oracle"),
      makeProviderResult("usdc_blacklist"),
      makeProviderResult("local_denylist"),
    ];

    mocks.provider.screenWallet = async () => makeCompositeResult(providerResults);

    const result = await screenWalletForDeal(BUYER, {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: "deal-id-1",
    });

    assert.equal(result.result, "Clear");
    assert.equal(mocks.calls.createComplianceCheck.length, 3);
    assert.deepEqual(
      mocks.calls.createComplianceCheck.map((call) => call.provider),
      ["chainalysis_sanctions_oracle", "usdc_blacklist", "local_denylist"],
    );
    assert.ok(
      mocks.calls.createComplianceCheck.every((call) => call.provider !== "composite"),
    );
    assert.ok(
      mocks.calls.createComplianceCheck.every(
        (call) =>
          call.actorWallet === BUYER.toLowerCase() && call.subjectType === "wallet",
      ),
    );
    assert.equal(mocks.calls.monitoringEvents.length, 1);
    assert.deepEqual(mocks.calls.monitoringEvents[0], {
      action: "funding_prepare",
      dealId: "deal-id-1",
      durationMs: mocks.calls.monitoringEvents[0].durationMs,
      outcome: "succeeded",
      reasonCode: "NO_HIT",
      walletCount: 1,
    });
    assert.equal(typeof mocks.calls.monitoringEvents[0].durationMs, "number");
  });

  test("records duration when single-wallet screening fails before persistence", async () => {
    mocks.provider.screenWallet = async () => {
      throw new Error("rpc down");
    };

    await assert.rejects(
      () =>
        screenWalletForDeal(BUYER, {
          action: "funding_prepare",
          actorWallet: BUYER,
          dealId: "deal-id-1",
        }),
      (error) => {
        assert.ok(error instanceof ComplianceServiceError);
        assert.equal(error.code, "SCREENING_FAILED");
        return true;
      },
    );

    assert.equal(mocks.calls.createComplianceCheck.length, 0);
    assert.equal(mocks.calls.monitoringEvents.length, 1);
    assert.deepEqual(mocks.calls.monitoringEvents[0], {
      action: "funding_prepare",
      dealId: "deal-id-1",
      durationMs: mocks.calls.monitoringEvents[0].durationMs,
      errorCode: "SCREENING_FAILED",
      outcome: "failed",
      walletCount: 1,
    });
    assert.equal(typeof mocks.calls.monitoringEvents[0].durationMs, "number");
  });

  test("records one provider_unavailable event for a single unavailable provider", async () => {
    const providerResults = [
      makeProviderResult("chainalysis_sanctions_oracle", {
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
      }),
      makeProviderResult("usdc_blacklist"),
      makeProviderResult("local_denylist"),
    ];

    mocks.provider.screenWallet = async () =>
      makeCompositeResult(providerResults, {
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
      });

    await screenWalletForDeal(BUYER, {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: "deal-id-1",
    });

    assert.deepEqual(mocks.calls.providerUnavailableEvents, [{
      action: "funding_prepare",
      dealId: "deal-id-1",
      provider: "chainalysis_sanctions_oracle",
      walletAddress: BUYER,
      walletCount: 1,
    }]);
  });

  test("records separate provider_unavailable events for multiple unavailable providers", async () => {
    const providerResults = [
      makeProviderResult("chainalysis_sanctions_oracle", {
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
      }),
      makeProviderResult("usdc_blacklist", {
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
      }),
      makeProviderResult("local_denylist"),
    ];

    mocks.provider.screenWallet = async () =>
      makeCompositeResult(providerResults, {
        provider: "chainalysis_sanctions_oracle",
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
      });

    await screenWalletForDeal(BUYER, {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: "deal-id-1",
    });

    assert.deepEqual(mocks.calls.providerUnavailableEvents, [
      {
        action: "funding_prepare",
        dealId: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        walletAddress: BUYER,
        walletCount: 1,
      },
      {
        action: "funding_prepare",
        dealId: "deal-id-1",
        provider: "usdc_blacklist",
        walletAddress: BUYER,
        walletCount: 1,
      },
    ]);
  });
});

describe("screenWalletsBatch", () => {
  test("returns results in input order and uses one actorWallet for all audit rows", async () => {
    mocks.provider.screenWallet = async (address: string) => {
      if (getAddress(address) === BUYER) {
        return makeCompositeResult([
          makeProviderResult("chainalysis_sanctions_oracle", { walletAddress: BUYER }),
          makeProviderResult("usdc_blacklist", { walletAddress: BUYER }),
          makeProviderResult("local_denylist", { walletAddress: BUYER }),
        ]);
      }

      return makeCompositeResult(
        [
          makeProviderResult("chainalysis_sanctions_oracle", {
            walletAddress: SELLER,
            reasonCode: "LOCAL_DENYLIST",
            result: "Blocked",
          }),
          makeProviderResult("usdc_blacklist", { walletAddress: SELLER }),
          makeProviderResult("local_denylist", { walletAddress: SELLER }),
        ],
        {
          provider: "local_denylist",
          reasonCode: "LOCAL_DENYLIST",
          result: "Blocked",
          walletAddress: SELLER,
        },
      );
    };

    const results = await screenWalletsBatch([BUYER, SELLER], {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: null,
    });

    assert.equal(results.length, 2);
    assert.equal(results[0].walletAddress, BUYER);
    assert.equal(results[1].walletAddress, SELLER);
    assert.equal(mocks.calls.createComplianceCheck.length, 6);
    assert.equal(mocks.calls.monitoringEvents.length, 1);
    assert.ok(
      mocks.calls.createComplianceCheck.every(
        (call) => call.actorWallet === BUYER.toLowerCase(),
      ),
    );
    assert.deepEqual(mocks.calls.monitoringEvents[0], {
      action: "funding_prepare",
      dealId: null,
      durationMs: mocks.calls.monitoringEvents[0].durationMs,
      outcome: "succeeded",
      walletCount: 2,
    });
    assert.equal("reasonCode" in mocks.calls.monitoringEvents[0], false);
    assert.equal(mocks.calls.enqueueDealRiskRecomputeRequest.length, 0);
  });

  test("recomputes deal risk status after persisting batch results for a deal", async () => {
    mocks.provider.screenWallet = async () =>
      makeCompositeResult(
        [
          makeProviderResult("chainalysis_sanctions_oracle", {
            reasonCode: "OFAC_SANCTIONS",
            result: "Blocked",
            walletAddress: BUYER,
          }),
          makeProviderResult("usdc_blacklist", { walletAddress: BUYER }),
          makeProviderResult("local_denylist", { walletAddress: BUYER }),
        ],
        {
          provider: "chainalysis_sanctions_oracle",
          reasonCode: "OFAC_SANCTIONS",
          result: "Blocked",
          walletAddress: BUYER,
        },
      );
    mocks.getById = async () => ({
      id: "deal-id-1",
      consultation_link_id: "link-id-1",
      onchain_deal_id: "1",
      buyer_address: BUYER,
      seller_address: SELLER,
      status: "Funded",
      risk_status: "Clear",
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: "2026-04-27T00:00:00.000Z",
    });
    mocks.findByDeal = async () => [makeCheck("Blocked", "OFAC_SANCTIONS")];

    const results = await screenWalletsBatch([BUYER], {
      action: "post_funding_sync",
      actorWallet: null,
      dealId: "deal-id-1",
    });

    assert.equal(results.length, 1);
    assert.deepEqual(mocks.calls.enqueueDealRiskRecomputeRequest, [{
      dealId: "deal-id-1",
      source: "post_funding_sync",
    }]);
    assert.deepEqual(mocks.calls.getById, ["deal-id-1"]);
    assert.deepEqual(mocks.calls.updateRiskStatusById, [["deal-id-1", "Blocked"]]);
    assert.deepEqual(mocks.calls.markDealRiskRecomputeRequestAppliedByDealSource, [{
      dealId: "deal-id-1",
      source: "post_funding_sync",
    }]);
  });

  test("records provider_unavailable events per wallet and provider in batch flow", async () => {
    mocks.provider.screenWallet = async (address: string) => {
      if (getAddress(address) === BUYER) {
        return makeCompositeResult(
          [
            makeProviderResult("chainalysis_sanctions_oracle", {
              reasonCode: "PROVIDER_UNAVAILABLE",
              result: "Blocked",
              walletAddress: BUYER,
            }),
            makeProviderResult("usdc_blacklist", { walletAddress: BUYER }),
            makeProviderResult("local_denylist", { walletAddress: BUYER }),
          ],
          {
            provider: "chainalysis_sanctions_oracle",
            reasonCode: "PROVIDER_UNAVAILABLE",
            result: "Blocked",
            walletAddress: BUYER,
          },
        );
      }

      return makeCompositeResult(
        [
          makeProviderResult("chainalysis_sanctions_oracle", { walletAddress: SELLER }),
          makeProviderResult("usdc_blacklist", {
            reasonCode: "PROVIDER_UNAVAILABLE",
            result: "Blocked",
            walletAddress: SELLER,
          }),
          makeProviderResult("local_denylist", { walletAddress: SELLER }),
        ],
        {
          provider: "usdc_blacklist",
          reasonCode: "PROVIDER_UNAVAILABLE",
          result: "Blocked",
          walletAddress: SELLER,
        },
      );
    };

    await screenWalletsBatch([BUYER, SELLER], {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: null,
    });

    assert.deepEqual(mocks.calls.providerUnavailableEvents, [
      {
        action: "funding_prepare",
        dealId: null,
        provider: "chainalysis_sanctions_oracle",
        walletAddress: BUYER,
        walletCount: 2,
      },
      {
        action: "funding_prepare",
        dealId: null,
        provider: "usdc_blacklist",
        walletAddress: SELLER,
        walletCount: 2,
      },
    ]);
  });

  test("does not record provider_unavailable events for non-provider-unavailable blocked reasons", async () => {
    mocks.provider.screenWallet = async () =>
      makeCompositeResult(
        [
          makeProviderResult("chainalysis_sanctions_oracle", {
            reasonCode: "OFAC_SANCTIONS",
            result: "Blocked",
            walletAddress: BUYER,
          }),
          makeProviderResult("usdc_blacklist", { walletAddress: BUYER }),
          makeProviderResult("local_denylist", { walletAddress: BUYER }),
        ],
        {
          provider: "chainalysis_sanctions_oracle",
          reasonCode: "OFAC_SANCTIONS",
          result: "Blocked",
          walletAddress: BUYER,
        },
      );

    await screenWalletsBatch([BUYER], {
      action: "funding_prepare",
      actorWallet: BUYER,
      dealId: null,
    });

    assert.deepEqual(mocks.calls.providerUnavailableEvents, []);
  });

  test("fails closed on partial audit write failure and skips recompute", async () => {
    let insertCalls = 0;
    const providerResults = [
      makeProviderResult("chainalysis_sanctions_oracle"),
      makeProviderResult("usdc_blacklist"),
      makeProviderResult("local_denylist"),
    ];

    mocks.provider.screenWallet = async () => makeCompositeResult(providerResults);
    mocks.createComplianceCheck = async (input: unknown) => {
      insertCalls += 1;
      if (insertCalls === 2) {
        throw new Error("db blip");
      }
      return input;
    };

    await assert.rejects(
      () =>
        screenWalletsBatch([BUYER], {
          action: "funding_prepare",
          actorWallet: BUYER,
          dealId: "deal-id-1",
        }),
      (error) => {
        assert.ok(error instanceof ComplianceServiceError);
        assert.equal(error.code, "AUDIT_WRITE_FAILED");
        return true;
      },
    );

    assert.equal(mocks.calls.getById.length, 0);
    assert.equal(mocks.calls.updateRiskStatusById.length, 0);
    assert.equal(mocks.calls.monitoringEvents.length, 1);
    assert.deepEqual(mocks.calls.enqueueDealRiskRecomputeRequest, [{
      dealId: "deal-id-1",
      source: "funding_prepare",
    }]);
    assert.equal(mocks.calls.markDealRiskRecomputeRequestAppliedByDealSource.length, 0);
  });

  test("recomputes immediately and marks queue applied for single-wallet deal screening", async () => {
    mocks.provider.screenWallet = async () =>
      makeCompositeResult([
        makeProviderResult("chainalysis_sanctions_oracle"),
        makeProviderResult("usdc_blacklist"),
        makeProviderResult("local_denylist"),
      ]);
    mocks.findByDeal = async () => [makeCheck("Review", "FRAUD_SIGNAL")];
    mocks.getById = async () => ({
      id: "deal-id-1",
      consultation_link_id: "link-id-1",
      onchain_deal_id: "1",
      buyer_address: BUYER,
      seller_address: SELLER,
      status: "ConfirmPending",
      risk_status: "Clear",
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: "2026-04-27T00:00:00.000Z",
    });

    await screenWalletForDeal(BUYER, {
      action: "lifecycle_release",
      actorWallet: BUYER,
      dealId: "deal-id-1",
    });

    assert.deepEqual(mocks.calls.enqueueDealRiskRecomputeRequest, [{
      dealId: "deal-id-1",
      source: "lifecycle_release",
    }]);
    assert.deepEqual(mocks.calls.markDealRiskRecomputeRequestAppliedByDealSource, [{
      dealId: "deal-id-1",
      source: "lifecycle_release",
    }]);
  });

  test("records duration when provider screening fails before persistence", async () => {
    mocks.provider.screenWallet = async () => {
      throw new Error("rpc down");
    };

    await assert.rejects(
      () =>
        screenWalletsBatch([BUYER], {
          action: "funding_prepare",
          actorWallet: BUYER,
          dealId: null,
        }),
      (error) => {
        assert.ok(error instanceof ComplianceServiceError);
        assert.equal(error.code, "SCREENING_FAILED");
        return true;
      },
    );

    assert.equal(mocks.calls.monitoringEvents.length, 1);
    assert.deepEqual(mocks.calls.monitoringEvents[0], {
      action: "funding_prepare",
      dealId: null,
      durationMs: mocks.calls.monitoringEvents[0].durationMs,
      errorCode: "SCREENING_FAILED",
      outcome: "failed",
      walletCount: 1,
    });
    assert.equal(typeof mocks.calls.monitoringEvents[0].durationMs, "number");
  });
});

describe("processPendingDealRiskRecomputeSweeps", () => {
  test("recomputes pending requests and marks them applied", async () => {
    mocks.listPendingDealRiskRecomputeRequests = async () => [{
      id: "request-1",
      deal_id: "deal-id-1",
      source: "post_funding_sync",
      status: "pending",
      applied_at: null,
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-04-27T00:00:00.000Z",
    }];
    mocks.getById = async () => ({
      id: "deal-id-1",
      consultation_link_id: "link-id-1",
      onchain_deal_id: "1",
      buyer_address: BUYER,
      seller_address: SELLER,
      status: "Funded",
      risk_status: "Clear",
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: "2026-04-27T00:00:00.000Z",
    });
    mocks.findByDeal = async () => [makeCheck("Blocked", "OFAC_SANCTIONS")];

    await processPendingDealRiskRecomputeSweeps();

    assert.equal(mocks.calls.listPendingDealRiskRecomputeRequests.length, 1);
    assert.deepEqual(mocks.calls.updateRiskStatusById, [["deal-id-1", "Blocked"]]);
    assert.deepEqual(mocks.calls.markDealRiskRecomputeRequestApplied, [["request-1"]]);
    assert.equal(mocks.calls.markDealRiskRecomputeRequestFailure.length, 0);
  });

  test("keeps pending requests when recompute fails", async () => {
    mocks.listPendingDealRiskRecomputeRequests = async () => [{
      id: "request-1",
      deal_id: "deal-id-1",
      source: "post_funding_sync",
      status: "pending",
      applied_at: null,
      last_error_code: null,
      last_error_message: null,
      created_at: "2026-04-27T00:00:00.000Z",
    }];
    mocks.findByDeal = async () => {
      throw new Error("db read failed");
    };

    await processPendingDealRiskRecomputeSweeps();

    assert.equal(mocks.calls.markDealRiskRecomputeRequestApplied.length, 0);
    assert.deepEqual(mocks.calls.markDealRiskRecomputeRequestFailure, [[
      "request-1",
      "RISK_STATUS_RECOMPUTE_FAILED",
      "Failed to load compliance history for deal.",
    ]]);
  });
});

describe("recomputeDealRiskStatus", () => {
  test("keeps Blocked sticky even after later Clear checks", async () => {
    mocks.getById = async () => ({
      id: "deal-id-1",
      consultation_link_id: "link-id-1",
      onchain_deal_id: "1",
      buyer_address: BUYER,
      seller_address: SELLER,
      status: "Funded",
      risk_status: "Blocked",
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: "2026-04-27T00:00:00.000Z",
    });
    mocks.findByDeal = async () => [
      makeCheck("Blocked", "OFAC_SANCTIONS"),
      makeCheck("Clear", "NO_HIT"),
    ];

    const riskStatus = await recomputeDealRiskStatus("deal-id-1");

    assert.equal(riskStatus, "Blocked");
    assert.equal(mocks.calls.updateRiskStatusById.length, 0);
  });

  test("leaves risk status unchanged when compliance history is empty", async () => {
    mocks.getById = async () => ({
      id: "deal-id-1",
      consultation_link_id: "link-id-1",
      onchain_deal_id: "1",
      buyer_address: BUYER,
      seller_address: SELLER,
      status: "Funded",
      risk_status: "Review",
      funded_at: null,
      completed_at: null,
      released_at: null,
      resolution_type: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      tx_hash: null,
      created_at: "2026-04-27T00:00:00.000Z",
    });
    mocks.findByDeal = async () => [];

    const riskStatus = await recomputeDealRiskStatus("deal-id-1");

    assert.equal(riskStatus, "Review");
    assert.equal(mocks.calls.updateRiskStatusById.length, 0);
  });
});

describe("assertDealNotBlocked", () => {
  test("returns when no blocked checks exist for the deal", async () => {
    mocks.findBlockedByDeal = async () => [];

    await assert.doesNotReject(() => assertDealNotBlocked("deal-id-1"));
  });

  test("raises canonical compliance error using persisted blocking check", async () => {
    mocks.findBlockedByDeal = async () => [
      {
        id: "blocked-1",
        actor_wallet: null,
        checked_at: "2026-04-27T01:00:00.000Z",
        deal_id: "deal-id-1",
        provider: "local_denylist",
        raw_summary: {},
        reason_code: "LOCAL_DENYLIST",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: SELLER.toLowerCase(),
      },
    ];

    await assert.rejects(
      () => assertDealNotBlocked("deal-id-1"),
      (error) => {
        assert.equal((error as { name?: string }).name, "ComplianceBlockedError");
        assert.equal((error as { provider?: string }).provider, "local_denylist");
        assert.equal((error as { reasonCode?: string }).reasonCode, "LOCAL_DENYLIST");
        assert.equal((error as { walletAddress?: string }).walletAddress, SELLER.toLowerCase());
        return true;
      },
    );
  });

  test("prefers higher-priority reason code over recency", async () => {
    mocks.findBlockedByDeal = async () => [
      {
        id: "z-newer",
        actor_wallet: null,
        checked_at: "2026-04-27T02:00:00.000Z",
        deal_id: "deal-id-1",
        provider: "local_denylist",
        raw_summary: {},
        reason_code: "LOCAL_DENYLIST",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: SELLER.toLowerCase(),
      },
      {
        id: "a-older",
        actor_wallet: null,
        checked_at: "2026-04-27T01:00:00.000Z",
        deal_id: "deal-id-1",
        provider: "chainalysis_sanctions_oracle",
        raw_summary: {},
        reason_code: "OFAC_SANCTIONS",
        result: "Blocked",
        subject_type: "wallet",
        subject_value: BUYER.toLowerCase(),
      },
    ];

    await assert.rejects(
      () => assertDealNotBlocked("deal-id-1"),
      (error) => {
        assert.equal((error as { reasonCode?: string }).reasonCode, "OFAC_SANCTIONS");
        assert.equal((error as { walletAddress?: string }).walletAddress, BUYER.toLowerCase());
        return true;
      },
    );
  });
});
