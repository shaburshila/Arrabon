import type { ComplianceProviderId } from "@/lib/db/types";

type BreakerState = "closed" | "half-open" | "open";

interface ProviderState {
  failureTimestamps: number[];
  openedAt: number | null;
  state: BreakerState;
}

export interface ComplianceCircuitBreakerOptions {
  failureThreshold: number;
  resetMs: number;
  windowMs: number;
}

function createProviderState(): ProviderState {
  return {
    failureTimestamps: [],
    openedAt: null,
    state: "closed",
  };
}

export class ComplianceCircuitBreaker {
  private readonly states = new Map<ComplianceProviderId, ProviderState>();

  constructor(private readonly options: ComplianceCircuitBreakerOptions) {}

  private logStateTransition(
    provider: ComplianceProviderId,
    fromState: BreakerState,
    toState: BreakerState,
    now: number,
  ): void {
    if (fromState === toState) {
      return;
    }

    console.info("compliance.circuit_breaker.state", {
      fromState,
      provider,
      timestamp: now,
      toState,
    });
  }

  private getProviderState(provider: ComplianceProviderId): ProviderState {
    const existing = this.states.get(provider);
    if (existing) {
      return existing;
    }

    const created = createProviderState();
    this.states.set(provider, created);
    return created;
  }

  private pruneFailures(state: ProviderState, now: number): void {
    const minTs = now - this.options.windowMs;
    state.failureTimestamps = state.failureTimestamps.filter((timestamp) => timestamp >= minTs);
  }

  getState(provider: ComplianceProviderId, now: number = Date.now()): BreakerState {
    const state = this.getProviderState(provider);

    if (
      state.state === "open" &&
      state.openedAt !== null &&
      now - state.openedAt >= this.options.resetMs
    ) {
      const previousState = state.state;
      state.state = "half-open";
      state.openedAt = null;
      state.failureTimestamps = [];
      this.logStateTransition(provider, previousState, state.state, now);
    }

    return state.state;
  }

  canRequest(provider: ComplianceProviderId, now: number = Date.now()): boolean {
    return this.getState(provider, now) !== "open";
  }

  recordFailure(provider: ComplianceProviderId, now: number = Date.now()): void {
    const state = this.getProviderState(provider);
    const currentState = this.getState(provider, now);

    if (currentState === "half-open") {
      const previousState = state.state;
      state.state = "open";
      state.openedAt = now;
      state.failureTimestamps = [];
      this.logStateTransition(provider, previousState, state.state, now);
      return;
    }

    this.pruneFailures(state, now);
    state.failureTimestamps.push(now);

    if (state.failureTimestamps.length >= this.options.failureThreshold) {
      const previousState = state.state;
      state.state = "open";
      state.openedAt = now;
      state.failureTimestamps = [];
      this.logStateTransition(provider, previousState, state.state, now);
    }
  }

  recordSuccess(provider: ComplianceProviderId, now: number = Date.now()): void {
    const state = this.getProviderState(provider);
    const previousState = state.state;
    state.state = "closed";
    state.openedAt = null;
    state.failureTimestamps = [];
    this.logStateTransition(provider, previousState, state.state, now);
  }
}

let complianceCircuitBreaker: ComplianceCircuitBreaker | null = null;

export function getComplianceCircuitBreaker(
  options: ComplianceCircuitBreakerOptions,
): ComplianceCircuitBreaker {
  if (complianceCircuitBreaker) {
    return complianceCircuitBreaker;
  }

  complianceCircuitBreaker = new ComplianceCircuitBreaker(options);
  return complianceCircuitBreaker;
}
