import { describe, test } from "node:test";
import assert from "node:assert/strict";

import { ComplianceCircuitBreaker } from "@/lib/compliance/circuit-breaker";

describe("ComplianceCircuitBreaker", () => {
  test("transitions from closed to open after the failure threshold", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 2,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("chainalysis_sanctions_oracle", 1_000);
    assert.equal(breaker.getState("chainalysis_sanctions_oracle", 1_001), "closed");

    breaker.recordFailure("chainalysis_sanctions_oracle", 2_000);
    assert.equal(breaker.getState("chainalysis_sanctions_oracle", 2_001), "open");
    assert.equal(breaker.canRequest("chainalysis_sanctions_oracle", 2_001), false);
  });

  test("transitions from open to half-open after reset timeout", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("usdc_blacklist", 1_000);

    assert.equal(breaker.getState("usdc_blacklist", 16_000), "half-open");
    assert.equal(breaker.canRequest("usdc_blacklist", 16_000), true);
  });

  test("transitions from half-open to closed on success", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("local_denylist", 1_000);
    assert.equal(breaker.getState("local_denylist", 16_000), "half-open");

    breaker.recordSuccess("local_denylist");

    assert.equal(breaker.getState("local_denylist", 16_001), "closed");
  });

  test("transitions from half-open back to open on failure", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("chainalysis_sanctions_oracle", 1_000);
    assert.equal(breaker.getState("chainalysis_sanctions_oracle", 16_000), "half-open");

    breaker.recordFailure("chainalysis_sanctions_oracle", 16_001);

    assert.equal(breaker.getState("chainalysis_sanctions_oracle", 16_002), "open");
    assert.equal(breaker.canRequest("chainalysis_sanctions_oracle", 16_002), false);
  });
});
