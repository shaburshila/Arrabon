import type { ComplianceProviderId } from "@/lib/db/types";
import type { CacheableScreeningResult } from "@/lib/compliance/types";

export const COMPLIANCE_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  result: CacheableScreeningResult;
}

function toCacheKey(provider: ComplianceProviderId, normalizedWallet: string): string {
  return `${provider}:${normalizedWallet}`;
}

export class ComplianceCache {
  private readonly entries = new Map<string, CacheEntry>();

  constructor(private readonly ttlMs: number = COMPLIANCE_CACHE_TTL_MS) {}

  clear(): void {
    this.entries.clear();
  }

  get(provider: ComplianceProviderId, normalizedWallet: string, now: number = Date.now()): CacheableScreeningResult | null {
    const key = toCacheKey(provider, normalizedWallet);
    const entry = this.entries.get(key);

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return null;
    }

    return entry.result;
  }

  set(
    provider: ComplianceProviderId,
    normalizedWallet: string,
    result: CacheableScreeningResult,
    now: number = Date.now(),
  ): void {
    this.entries.set(toCacheKey(provider, normalizedWallet), {
      expiresAt: now + this.ttlMs,
      result,
    });
  }
}

let complianceCache: ComplianceCache | null = null;

export function getComplianceCache(): ComplianceCache {
  if (complianceCache) {
    return complianceCache;
  }

  complianceCache = new ComplianceCache();
  return complianceCache;
}
