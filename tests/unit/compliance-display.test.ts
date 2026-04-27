import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { getComplianceDisplay } from "@/lib/compliance/display";

describe("getComplianceDisplay", () => {
  test("maps OFAC sanctions to a non-retryable Chainalysis link", () => {
    const result = getComplianceDisplay("OFAC_SANCTIONS");

    assert.equal(result.isRetryable, false);
    assert.equal(result.title, "Sanctions screening blocked this action");
    assert.equal(result.verificationLabel, "Review Chainalysis screening");
    assert.equal(result.verificationUrl, "https://www.chainalysis.com/sanctions/");
  });

  test("maps USDC blacklist to a non-retryable Basescan link", () => {
    const result = getComplianceDisplay("USDC_BLACKLISTED");

    assert.equal(result.isRetryable, false);
    assert.equal(result.title, "USDC blacklist blocked this action");
    assert.equal(result.verificationLabel, "Review USDC contract on Basescan");
  });

  test("maps local denylist to a support mailto link", () => {
    const result = getComplianceDisplay("LOCAL_DENYLIST");

    assert.equal(result.isRetryable, false);
    assert.equal(result.verificationLabel, "Contact support");
    assert.equal(result.verificationUrl, "mailto:support@baseconsult.link");
  });

  test("maps provider unavailable to a retryable state without links", () => {
    const result = getComplianceDisplay("PROVIDER_UNAVAILABLE");

    assert.equal(result.isRetryable, true);
    assert.equal(result.verificationLabel, null);
    assert.equal(result.verificationUrl, null);
  });

  test("falls back to a generic blocked message for unknown reason codes", () => {
    const result = getComplianceDisplay("SOMETHING_NEW");

    assert.equal(result.isRetryable, false);
    assert.equal(result.title, "Compliance screening blocked this action");
    assert.equal(result.verificationLabel, null);
    assert.equal(result.verificationUrl, null);
  });
});
