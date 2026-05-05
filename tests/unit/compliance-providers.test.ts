import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { getAddress, type Address } from "viem";

import { ComplianceCache } from "@/lib/compliance/cache";
import { ComplianceCircuitBreaker } from "@/lib/compliance/circuit-breaker";
import { createCompositeComplianceProvider } from "@/lib/compliance/composite";
import { createChainalysisDevProvider } from "@/lib/compliance/providers/chainalysis-dev";
import { createChainalysisOracleProvider } from "@/lib/compliance/providers/chainalysis-oracle";
import { createLocalDenylistProvider } from "@/lib/compliance/providers/local-denylist";
import { createUsdcDevProvider } from "@/lib/compliance/providers/usdc-dev";
import { createUsdcBlacklistProvider } from "@/lib/compliance/providers/usdc-blacklist";
import type { ComplianceProvider, ProviderScreeningResult } from "@/lib/compliance/types";

const TEST_WALLET = getAddress("0x00000000000000000000000000000000000000AA");
const CIRCUIT_BREAKER_EVENT = "compliance.circuit_breaker.state";

function makeProvider(
  id: ComplianceProvider["id"],
  screenWallet: (address: string) => Promise<ProviderScreeningResult>,
): ComplianceProvider {
  return { id, screenWallet };
}

describe("compliance providers", () => {
  test("Chainalysis dev provider returns Clear by default", async () => {
    delete process.env.COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE;
    const provider = createChainalysisDevProvider();

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("Chainalysis provider returns Clear when oracle returns false", async () => {
    const provider = createChainalysisOracleProvider({
      client: {
        readContract: async () => false,
      },
      oracleAddress: getAddress("0x00000000000000000000000000000000000000C1"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("Chainalysis provider returns Blocked when oracle returns true", async () => {
    const provider = createChainalysisOracleProvider({
      client: {
        readContract: async () => true,
      },
      oracleAddress: getAddress("0x00000000000000000000000000000000000000C1"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "OFAC_SANCTIONS");
  });

  test("Chainalysis provider maps network error to PROVIDER_UNAVAILABLE", async () => {
    const provider = createChainalysisOracleProvider({
      client: {
        readContract: async () => {
          throw new Error("rpc down");
        },
      },
      oracleAddress: getAddress("0x00000000000000000000000000000000000000C1"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "PROVIDER_UNAVAILABLE");
  });

  test("USDC blacklist provider returns Clear when contract returns false", async () => {
    const provider = createUsdcBlacklistProvider({
      client: {
        readContract: async () => false,
      },
      usdcAddress: getAddress("0x00000000000000000000000000000000000000C2"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("USDC blacklist provider returns Blocked when contract returns true", async () => {
    const provider = createUsdcBlacklistProvider({
      client: {
        readContract: async () => true,
      },
      usdcAddress: getAddress("0x00000000000000000000000000000000000000C2"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "USDC_BLACKLISTED");
  });

  test("USDC blacklist provider maps network error to PROVIDER_UNAVAILABLE", async () => {
    const provider = createUsdcBlacklistProvider({
      client: {
        readContract: async () => {
          throw new Error("timeout");
        },
      },
      usdcAddress: getAddress("0x00000000000000000000000000000000000000C2"),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "PROVIDER_UNAVAILABLE");
  });

  test("USDC dev provider returns Clear by default", async () => {
    delete process.env.COMPLIANCE_USDC_DEV_MOCK_MODE;
    const provider = createUsdcDevProvider();

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("USDC dev provider returns Blocked in blocked mode", async () => {
    process.env.COMPLIANCE_USDC_DEV_MOCK_MODE = "blocked";
    const provider = createUsdcDevProvider();

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "USDC_BLACKLISTED");
  });

  test("USDC dev provider returns PROVIDER_UNAVAILABLE in unavailable mode", async () => {
    process.env.COMPLIANCE_USDC_DEV_MOCK_MODE = "unavailable";
    const provider = createUsdcDevProvider();

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "PROVIDER_UNAVAILABLE");
  });

  test("Local denylist provider returns Clear when wallet is absent", async () => {
    const provider = createLocalDenylistProvider({
      findWallet: async () => null,
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("Local denylist provider returns Blocked when wallet exists", async () => {
    const provider = createLocalDenylistProvider({
      findWallet: async () => ({
        wallet: TEST_WALLET.toLowerCase(),
        reason: "sanctions",
        added_by_wallet: "0xAdmin",
        added_at: "2026-04-25T00:00:00.000Z",
        notes: "manual block",
      }),
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "LOCAL_DENYLIST");
  });

  test("Local denylist provider maps repository error to PROVIDER_UNAVAILABLE", async () => {
    const provider = createLocalDenylistProvider({
      findWallet: async () => {
        throw new Error("db down");
      },
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "PROVIDER_UNAVAILABLE");
  });
});

describe("composite compliance provider", () => {
  let cache: ComplianceCache;
  let breaker: ComplianceCircuitBreaker;

  beforeEach(() => {
    delete process.env.COMPLIANCE_CHAINALYSIS_DEV_MOCK_MODE;
    delete process.env.COMPLIANCE_USDC_DEV_MOCK_MODE;
    cache = new ComplianceCache();
    breaker = new ComplianceCircuitBreaker({
      failureThreshold: 2,
      resetMs: 15_000,
      windowMs: 10_000,
    });
  });

  test("returns Clear when all providers clear", async () => {
    const provider = createCompositeComplianceProvider({
      breaker,
      cache,
      providers: [
        makeProvider("chainalysis_sanctions_oracle", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "chainalysis_sanctions_oracle",
          rawSummary: { source: "chainalysis" },
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress: TEST_WALLET,
        })),
        makeProvider("usdc_blacklist", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "usdc_blacklist",
          rawSummary: { source: "usdc" },
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress: TEST_WALLET,
        })),
        makeProvider("local_denylist", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "local_denylist",
          rawSummary: { source: "denylist" },
          reasonCode: "NO_HIT",
          result: "Clear",
          walletAddress: TEST_WALLET,
        })),
      ],
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Clear");
    assert.equal(result.reasonCode, "NO_HIT");
  });

  test("uses deterministic reason priority across multiple hits", async () => {
    const provider = createCompositeComplianceProvider({
      breaker,
      cache,
      providers: [
        makeProvider("local_denylist", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "local_denylist",
          rawSummary: { source: "denylist" },
          reasonCode: "LOCAL_DENYLIST",
          result: "Blocked",
          walletAddress: TEST_WALLET,
        })),
        makeProvider("usdc_blacklist", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "usdc_blacklist",
          rawSummary: { source: "usdc" },
          reasonCode: "USDC_BLACKLISTED",
          result: "Blocked",
          walletAddress: TEST_WALLET,
        })),
        makeProvider("chainalysis_sanctions_oracle", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "chainalysis_sanctions_oracle",
          rawSummary: { source: "chainalysis" },
          reasonCode: "OFAC_SANCTIONS",
          result: "Blocked",
          walletAddress: TEST_WALLET,
        })),
      ],
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "OFAC_SANCTIONS");
  });

  test("prefers a real hit over PROVIDER_UNAVAILABLE", async () => {
    const provider = createCompositeComplianceProvider({
      breaker,
      cache,
      providers: [
        makeProvider("chainalysis_sanctions_oracle", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "chainalysis_sanctions_oracle",
          rawSummary: { source: "chainalysis" },
          reasonCode: "PROVIDER_UNAVAILABLE",
          result: "Blocked",
          walletAddress: TEST_WALLET,
        })),
        makeProvider("usdc_blacklist", async () => ({
          normalizedWallet: TEST_WALLET.toLowerCase(),
          provider: "usdc_blacklist",
          rawSummary: { source: "usdc" },
          reasonCode: "USDC_BLACKLISTED",
          result: "Blocked",
          walletAddress: TEST_WALLET,
        })),
      ],
    });

    const result = await provider.screenWallet(TEST_WALLET);

    assert.equal(result.result, "Blocked");
    assert.equal(result.reasonCode, "USDC_BLACKLISTED");
  });

  test("does not cache PROVIDER_UNAVAILABLE results", async () => {
    let calls = 0;
    const provider = createCompositeComplianceProvider({
      breaker,
      cache,
      providers: [
        makeProvider("chainalysis_sanctions_oracle", async () => {
          calls += 1;
          return {
            normalizedWallet: TEST_WALLET.toLowerCase(),
            provider: "chainalysis_sanctions_oracle",
            rawSummary: { attempt: calls },
            reasonCode: "PROVIDER_UNAVAILABLE",
            result: "Blocked",
            walletAddress: TEST_WALLET,
          };
        }),
      ],
    });

    await provider.screenWallet(TEST_WALLET);
    await provider.screenWallet(TEST_WALLET);

    assert.equal(calls, 2);
    assert.equal(cache.get("chainalysis_sanctions_oracle", TEST_WALLET.toLowerCase()), null);
  });
});

describe("compliance circuit breaker monitoring", () => {
  let events: Array<Record<string, unknown>>;
  let originalConsoleInfo: typeof console.info;

  beforeEach(() => {
    events = [];
    originalConsoleInfo = console.info;
    console.info = (message, payload, ...rest) => {
      if (message === CIRCUIT_BREAKER_EVENT && payload && typeof payload === "object") {
        events.push(payload as Record<string, unknown>);
        return;
      }

      return originalConsoleInfo(message, payload, ...rest);
    };
  });

  afterEach(() => {
    console.info = originalConsoleInfo;
  });

  test("logs closed to open when failure threshold is reached", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 2,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("chainalysis_sanctions_oracle", 1_000);
    breaker.recordFailure("chainalysis_sanctions_oracle", 2_000);

    assert.deepEqual(events, [
      {
        fromState: "closed",
        provider: "chainalysis_sanctions_oracle",
        timestamp: 2_000,
        toState: "open",
      },
    ]);
  });

  test("logs open to half-open when reset window elapses", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("usdc_blacklist", 1_000);
    events = [];

    const state = breaker.getState("usdc_blacklist", 16_000);

    assert.equal(state, "half-open");
    assert.deepEqual(events, [
      {
        fromState: "open",
        provider: "usdc_blacklist",
        timestamp: 16_000,
        toState: "half-open",
      },
    ]);
  });

  test("logs half-open to closed on successful recovery", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("local_denylist", 1_000);
    breaker.getState("local_denylist", 16_000);
    events = [];

    breaker.recordSuccess("local_denylist", 17_000);

    assert.deepEqual(events, [
      {
        fromState: "half-open",
        provider: "local_denylist",
        timestamp: 17_000,
        toState: "closed",
      },
    ]);
  });

  test("does not log duplicate transition events for repeated reads", () => {
    const breaker = new ComplianceCircuitBreaker({
      failureThreshold: 1,
      resetMs: 15_000,
      windowMs: 10_000,
    });

    breaker.recordFailure("chainalysis_sanctions_oracle", 1_000);
    events = [];

    breaker.getState("chainalysis_sanctions_oracle", 16_000);
    breaker.getState("chainalysis_sanctions_oracle", 17_000);

    assert.deepEqual(events, [
      {
        fromState: "open",
        provider: "chainalysis_sanctions_oracle",
        timestamp: 16_000,
        toState: "half-open",
      },
    ]);
  });
});
