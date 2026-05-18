import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { keccak256, stringToBytes } from "viem";

import type { ConsultationLinkRow, DealRow } from "@/lib/db/types";
import {
  exchangeFundingGrantForLink,
  FundingServiceError,
  prepareFundingForLink,
} from "@/server/services/funding";
import { ConsultEscrowConfigError } from "@/lib/base/consult-escrow";

interface FundingComplianceMocks {
  assertCompliance: (...args: unknown[]) => void;
  calls: {
    assertCompliance: unknown[][];
    createFundingAuthorizationNonce: unknown[][];
    createFundingExecutionGrant: unknown[][];
    consumeFundingExecutionGrant: unknown[][];
    prepareCreateAndFundDealCall: unknown[];
    screenWalletsBatch: unknown[][];
    signFundingAuthorization: unknown[][];
  };
  createFundingAuthorizationNonce: (...args: unknown[]) => string;
  createFundingExecutionGrant: (...args: unknown[]) => Promise<unknown>;
  consumeFundingExecutionGrant: (...args: unknown[]) => Promise<unknown>;
  getByConsultationLinkId: (...args: unknown[]) => Promise<DealRow | null>;
  getById: (...args: unknown[]) => Promise<ConsultationLinkRow | null>;
  prepareCreateAndFundDealCall: (...args: unknown[]) => unknown;
  reset: () => void;
  screenWalletsBatch: (...args: unknown[]) => Promise<Array<{
    normalizedWallet: string;
    provider: string | null;
    rawSummary: Record<string, unknown>;
    reasonCode: string;
    result: string;
    walletAddress: string;
  }>>;
  signFundingAuthorization: (...args: unknown[]) => Promise<string>;
}

const mocks = (
  global as typeof globalThis & { __fundingComplianceMocks: FundingComplianceMocks }
).__fundingComplianceMocks;

const currentUser = {
  avatar_url: null,
  expires_at: "2026-04-27T12:00:00.000Z",
  id: "user-id-1",
  is_admin: false,
  username: null,
  wallet_address: "0x00000000000000000000000000000000000000AA",
};

function makeLink(overrides: Partial<ConsultationLinkRow> = {}): ConsultationLinkRow {
  return {
    id: "link-id-1",
    creator_user_id: "user-id-1",
    expert_address: "0x00000000000000000000000000000000000000BB",
    title: "Test Consultation",
    description: "Desc",
    price_usdc: "100.00",
    scheduled_at: "2030-04-28T12:00:00.000Z",
    timezone: "UTC",
    expires_at: "2030-04-28T11:00:00.000Z",
    duration_minutes: 30,
    meeting_url_encrypted: "encrypted",
    link_hash: "0x" + "1".repeat(64),
    status: "Open",
    created_at: "2030-04-27T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  mocks.reset();
  mocks.getById = async () => makeLink();
  mocks.getByConsultationLinkId = async () => null;
  mocks.screenWalletsBatch = async () => [
    {
      normalizedWallet: currentUser.wallet_address.toLowerCase(),
      provider: null,
      rawSummary: { providerResults: [] },
      reasonCode: "NO_HIT",
      result: "Clear",
      walletAddress: currentUser.wallet_address,
    },
    {
      normalizedWallet: "0x00000000000000000000000000000000000000bb",
      provider: null,
      rawSummary: { providerResults: [] },
      reasonCode: "NO_HIT",
      result: "Clear",
      walletAddress: "0x00000000000000000000000000000000000000BB",
    },
  ];
});

describe("prepareFundingForLink compliance gate", () => {
  test("issues funding grant without generating calldata", async () => {
    const result = await prepareFundingForLink(currentUser, { linkId: "link-id-1" });

    assert.equal(result.consultation_link_id, "link-id-1");
    assert.match(result.grant_token, /^[0-9a-f]{64}$/);
    assert.equal(result.contract_address, "0x0000000000000000000000000000000000000001");
    assert.equal(result.approval_amount, String(103_000_000));
    assert.equal(mocks.calls.screenWalletsBatch.length, 0);
    assert.equal(mocks.calls.assertCompliance.length, 0);
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 0);
  });

  test("stores funding grant for the authenticated buyer wallet", async () => {
    const result = await prepareFundingForLink(currentUser, { linkId: "link-id-1" });
    const grantInput = mocks.calls.createFundingExecutionGrant[0][0] as {
      consultationLinkId: string;
      expiresAt: string;
      issuedByWallet: string;
      issuedToWallet: string;
      tokenHash: string;
    };

    assert.equal(mocks.calls.createFundingExecutionGrant.length, 1);
    assert.deepEqual(grantInput, {
      consultationLinkId: "link-id-1",
      expiresAt: result.expires_at,
      issuedByWallet: currentUser.wallet_address,
      issuedToWallet: currentUser.wallet_address,
      tokenHash: grantInput.tokenHash,
    });
    assert.match(grantInput.tokenHash, /^[0-9a-f]{64}$/);
  });

  test("exchange screens buyer and seller before calldata generation", async () => {
    const result = await exchangeFundingGrantForLink(
      currentUser,
      { linkId: "link-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.consultation_link_id, "link-id-1");
    assert.equal(mocks.calls.screenWalletsBatch.length, 1);
    assert.deepEqual(mocks.calls.screenWalletsBatch[0], [
      [currentUser.wallet_address, "0x00000000000000000000000000000000000000BB"],
      {
        action: "funding_prepare",
        actorWallet: currentUser.wallet_address,
        dealId: null,
      },
    ]);
    assert.equal(mocks.calls.assertCompliance.length, 2);
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 1);
    assert.equal(mocks.calls.consumeFundingExecutionGrant.length, 1);
    assert.equal(mocks.calls.createFundingAuthorizationNonce.length, 1);
    assert.equal(mocks.calls.signFundingAuthorization.length, 1);
    assert.deepEqual(Object.keys(result).sort(), ["consultation_link_id", "contract_call"]);

    const signingInput = mocks.calls.signFundingAuthorization[0][0] as {
      buyer: string;
      consultationLinkIdHash: string;
      deadline: bigint;
      durationMinutes: bigint;
      linkHash: string;
      linkExpiresAt: bigint;
      nonce: string;
      price: bigint;
      scheduledAt: bigint;
      seller: string;
    };
    const preparedCallInput = mocks.calls.prepareCreateAndFundDealCall[0] as {
      buyerAddress: string;
      consultationLinkIdHash: string;
      deadline: bigint;
      durationMinutes: number;
      linkHash: string;
      linkExpiresAt: bigint;
      nonce: string;
      priceUsdc: string;
      scheduledAt: Date;
      sellerAddress: string;
      signature: string;
    };

    assert.equal(signingInput.buyer, currentUser.wallet_address);
    assert.equal(signingInput.seller, "0x00000000000000000000000000000000000000bb");
    assert.equal(signingInput.consultationLinkIdHash, keccak256(stringToBytes("link-id-1")));
    assert.equal(signingInput.linkHash, "0x" + "1".repeat(64));
    assert.equal(signingInput.price, BigInt(100_000_000));
    assert.equal(signingInput.scheduledAt, BigInt(1903608000));
    assert.equal(signingInput.durationMinutes, BigInt(30));
    assert.equal(signingInput.linkExpiresAt, BigInt(1903604400));
    assert.equal(signingInput.deadline, preparedCallInput.deadline);
    assert.equal(signingInput.nonce, "0x" + "2".repeat(64));
    assert.equal(preparedCallInput.consultationLinkIdHash, signingInput.consultationLinkIdHash);
    assert.equal(preparedCallInput.linkExpiresAt, signingInput.linkExpiresAt);
    assert.equal(preparedCallInput.nonce, "0x" + "2".repeat(64));
    assert.equal(preparedCallInput.signature, "0x" + "3".repeat(130));
  });

  test("blocked buyer stops exchange before calldata generation", async () => {
    const blocked = new Error("blocked");

    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: "chainalysis_sanctions_oracle",
        rawSummary: { providerResults: [] },
        reasonCode: "OFAC_SANCTIONS",
        result: "Blocked",
        walletAddress: currentUser.wallet_address,
      },
      {
        normalizedWallet: "0x00000000000000000000000000000000000000bb",
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      },
    ];
    mocks.assertCompliance = (...args) => {
      if ((args[0] as { result: string }).result === "Blocked") {
        throw blocked;
      }
    };

    await assert.rejects(
      () => exchangeFundingGrantForLink(currentUser, { linkId: "link-id-1" }, "a".repeat(64)),
      blocked,
    );
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 0);
    assert.equal(mocks.calls.consumeFundingExecutionGrant.length, 0);
  });

  test("blocked seller stops exchange before calldata generation", async () => {
    const blocked = new Error("blocked seller");

    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: currentUser.wallet_address,
      },
      {
        normalizedWallet: "0x00000000000000000000000000000000000000bb",
        provider: "local_denylist",
        rawSummary: { providerResults: [] },
        reasonCode: "LOCAL_DENYLIST",
        result: "Blocked",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      },
    ];
    mocks.assertCompliance = (...args) => {
      if ((args[0] as { result: string }).result === "Blocked") {
        throw blocked;
      }
    };

    await assert.rejects(
      () => exchangeFundingGrantForLink(currentUser, { linkId: "link-id-1" }, "a".repeat(64)),
      blocked,
    );
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 0);
    assert.equal(mocks.calls.consumeFundingExecutionGrant.length, 0);
  });

  test("provider unavailable blocks exchange", async () => {
    const blocked = new Error("provider unavailable");

    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: "chainalysis_sanctions_oracle",
        rawSummary: { providerResults: [] },
        reasonCode: "PROVIDER_UNAVAILABLE",
        result: "Blocked",
        walletAddress: currentUser.wallet_address,
      },
      {
        normalizedWallet: "0x00000000000000000000000000000000000000bb",
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      },
    ];
    mocks.assertCompliance = (...args) => {
      if ((args[0] as { result: string }).result === "Blocked") {
        throw blocked;
      }
    };

    await assert.rejects(
      () => exchangeFundingGrantForLink(currentUser, { linkId: "link-id-1" }, "a".repeat(64)),
      blocked,
    );
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 0);
    assert.equal(mocks.calls.consumeFundingExecutionGrant.length, 0);
  });

  test("defensive Review does not block exchange", async () => {
    mocks.screenWalletsBatch = async () => [
      {
        normalizedWallet: currentUser.wallet_address.toLowerCase(),
        provider: "local_denylist",
        rawSummary: { providerResults: [] },
        reasonCode: "FRAUD_SIGNAL",
        result: "Review",
        walletAddress: currentUser.wallet_address,
      },
      {
        normalizedWallet: "0x00000000000000000000000000000000000000bb",
        provider: null,
        rawSummary: { providerResults: [] },
        reasonCode: "NO_HIT",
        result: "Clear",
        walletAddress: "0x00000000000000000000000000000000000000BB",
      },
    ];

    const result = await exchangeFundingGrantForLink(
      currentUser,
      { linkId: "link-id-1" },
      "a".repeat(64),
    );

    assert.equal(result.consultation_link_id, "link-id-1");
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 1);
  });

  test("buyer equals seller rejects before compliance is called", async () => {
    mocks.getById = async () =>
      makeLink({ expert_address: currentUser.wallet_address });

    await assert.rejects(
      () => prepareFundingForLink(currentUser, { linkId: "link-id-1" }),
      (error) => {
        assert.ok(error instanceof FundingServiceError);
        assert.equal(error.code, "BUYER_EQUALS_SELLER");
        return true;
      },
    );

    assert.equal(mocks.calls.screenWalletsBatch.length, 0);
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 0);
  });

  test("exchange rejects invalid funding grant token", async () => {
    await assert.rejects(
      () => exchangeFundingGrantForLink(currentUser, { linkId: "link-id-1" }, "bad"),
      (error) => {
        assert.ok(error instanceof FundingServiceError);
        assert.equal(error.code, "FUNDING_GRANT_INVALID");
        return true;
      },
    );
  });

  test("exchange returns 500 after consume if calldata generation fails", async () => {
    mocks.prepareCreateAndFundDealCall = () => {
      throw new ConsultEscrowConfigError("Missing consult escrow address configuration.");
    };

    await assert.rejects(
      () => exchangeFundingGrantForLink(currentUser, { linkId: "link-id-1" }, "a".repeat(64)),
      (error) => {
        assert.ok(error instanceof FundingServiceError);
        assert.equal(error.status, 500);
        assert.equal(error.code, "CONTRACT_CONFIG_UNAVAILABLE");
        return true;
      },
    );

    assert.equal(mocks.calls.consumeFundingExecutionGrant.length, 1);
    assert.equal(mocks.calls.signFundingAuthorization.length, 1);
    assert.equal(mocks.calls.prepareCreateAndFundDealCall.length, 1);
  });
});
