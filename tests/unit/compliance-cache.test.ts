import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAddress } from "viem";

import {
  COMPLIANCE_CACHE_TTL_MS,
  ComplianceCache,
} from "@/lib/compliance/cache";
import type { CacheableScreeningResult } from "@/lib/compliance/types";

function makeClearResult(
  wallet: `0x${string}` = "0x00000000000000000000000000000000000000AA",
): CacheableScreeningResult {
  const walletAddress = getAddress(wallet);
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "chainalysis_sanctions_oracle",
    rawSummary: { source: "test" },
    reasonCode: "NO_HIT",
    result: "Clear",
    walletAddress,
  };
}

function makeBlockedResult(
  wallet: `0x${string}` = "0x00000000000000000000000000000000000000BB",
): CacheableScreeningResult {
  const walletAddress = getAddress(wallet);
  return {
    normalizedWallet: walletAddress.toLowerCase(),
    provider: "usdc_blacklist",
    rawSummary: { source: "test" },
    reasonCode: "USDC_BLACKLISTED",
    result: "Blocked",
    walletAddress,
  };
}

describe("ComplianceCache", () => {
  test("stores and returns Clear results within the fixed 5 minute TTL", () => {
    const cache = new ComplianceCache();
    const result = makeClearResult();
    const now = 1_000;

    cache.set("chainalysis_sanctions_oracle", result.normalizedWallet, result, now);

    assert.deepEqual(
      cache.get("chainalysis_sanctions_oracle", result.normalizedWallet, now + COMPLIANCE_CACHE_TTL_MS - 1),
      result,
    );
  });

  test("expires entries exactly at the TTL boundary", () => {
    const cache = new ComplianceCache();
    const result = makeBlockedResult();
    const now = 2_000;

    cache.set("usdc_blacklist", result.normalizedWallet, result, now);

    assert.equal(
      cache.get("usdc_blacklist", result.normalizedWallet, now + COMPLIANCE_CACHE_TTL_MS),
      null,
    );
  });

  test("scopes cache entries by provider and normalized wallet", () => {
    const cache = new ComplianceCache();
    const result = makeClearResult();

    cache.set("chainalysis_sanctions_oracle", result.normalizedWallet, result, 5_000);

    assert.equal(cache.get("usdc_blacklist", result.normalizedWallet, 5_001), null);
    assert.equal(cache.get("chainalysis_sanctions_oracle", "0xdeadbeef", 5_001), null);
  });
});
