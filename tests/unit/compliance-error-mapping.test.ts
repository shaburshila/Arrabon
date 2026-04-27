import { describe, test } from "node:test";
import assert from "node:assert/strict";

import {
  assertCompliance,
  complianceErrorToHttpResponse,
  ComplianceBlockedError,
  withComplianceErrorHandling,
} from "@/lib/compliance/error-mapping";

const BASE_CONTEXT = {
  action: "funding_prepare" as const,
  actorWallet: "0x00000000000000000000000000000000000000aa",
  dealId: "deal-id-1",
};

describe("assertCompliance", () => {
  test("throws only for Blocked results", async () => {
    assert.doesNotThrow(() =>
      assertCompliance(
        {
          normalizedWallet: "0x00000000000000000000000000000000000000aa",
          provider: null,
          rawSummary: { providerResults: [] },
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress: "0x00000000000000000000000000000000000000AA",
        },
        "0x00000000000000000000000000000000000000AA",
        BASE_CONTEXT,
      ),
    );

    assert.doesNotThrow(() =>
      assertCompliance(
        {
          normalizedWallet: "0x00000000000000000000000000000000000000aa",
          provider: "local_denylist",
          rawSummary: { providerResults: [] },
          reasonCode: "FRAUD_SIGNAL",
          result: "Review",
          walletAddress: "0x00000000000000000000000000000000000000AA",
        },
        "0x00000000000000000000000000000000000000AA",
        BASE_CONTEXT,
      ),
    );

    assert.throws(
      () =>
        assertCompliance(
          {
            normalizedWallet: "0x00000000000000000000000000000000000000aa",
            provider: "local_denylist",
            rawSummary: { notes: "secret admin note" },
            reasonCode: "LOCAL_DENYLIST",
            result: "Blocked",
            walletAddress: "0x00000000000000000000000000000000000000AA",
          },
          "0x00000000000000000000000000000000000000AA",
          BASE_CONTEXT,
        ),
      (error) => error instanceof ComplianceBlockedError,
    );
  });
});

describe("complianceErrorToHttpResponse", () => {
  test("returns stable 403 body without leaking internal details", async () => {
    const response = complianceErrorToHttpResponse(
      new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "local_denylist",
        reasonCode: "LOCAL_DENYLIST",
        walletAddress: "0x00000000000000000000000000000000000000AA",
      }),
    );

    assert.equal(response.status, 403);
    const body = await response.json();

    assert.deepEqual(body, {
      code: "COMPLIANCE_BLOCKED",
      error: "Wallet blocked by compliance screening.",
      reason_code: "LOCAL_DENYLIST",
      wallet_address: "0x00000000000000000000000000000000000000aa",
    });
  });
});

describe("withComplianceErrorHandling", () => {
  test("maps ComplianceBlockedError to 403 and preserves other errors", async () => {
    const wrapped = withComplianceErrorHandling(async () => {
      throw new ComplianceBlockedError({
        dealId: "deal-id-1",
        provider: "usdc_blacklist",
        reasonCode: "USDC_BLACKLISTED",
        walletAddress: "0x00000000000000000000000000000000000000AA",
      });
    });

    const response = await wrapped();
    assert.equal(response.status, 403);

    await assert.rejects(
      () =>
        withComplianceErrorHandling(async () => {
          throw new Error("boom");
        })(),
      /boom/,
    );
  });
});
