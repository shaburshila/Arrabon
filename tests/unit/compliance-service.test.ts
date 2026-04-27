import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";

import type { ComplianceCheckRow, DealRow } from "@/lib/db/types";
import {
  ComplianceServiceError,
  recomputeDealRiskStatus,
  screenWalletForDeal,
  screenWalletsBatch,
} from "@/server/services/compliance";

interface ComplianceServiceMocks {
  calls: {
    createComplianceCheck: Array<Record<string, unknown>>;
    getById: string[];
    updateRiskStatusById: Array<[string, DealRow["risk_status"]]>;
  };
  createComplianceCheck: (...args: unknown[]) => Promise<unknown>;
  findByDeal: (...args: unknown[]) => Promise<ComplianceCheckRow[]>;
  getById: (...args: unknown[]) => Promise<DealRow | null>;
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
    assert.ok(
      mocks.calls.createComplianceCheck.every(
        (call) => call.actorWallet === BUYER.toLowerCase(),
      ),
    );
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
