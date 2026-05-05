import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { DealActionsCard } from "@/components/deal/deal-actions-card";
import type { DealAction } from "@/hooks/use-deal-action";
import type { WalletSessionState } from "@/hooks/use-wallet-session";

function makeSession(): WalletSessionState {
  return {
    address: "0x00000000000000000000000000000000000000AA",
    chainId: 8453,
    connect: async () => {},
    disconnect: async () => {},
    isConnected: true,
    isCorrectChain: true,
    isSigningIn: false,
    session: null,
    signIn: async () => {},
    signInError: null,
    signOut: async () => {},
    siweStatus: "authenticated",
    switchToCorrectChain: async () => {},
  };
}

function makeBlockedAction(): DealAction {
  return {
    execute: async () => {},
    reset: () => {},
    state: {
      complianceReasonCode: "USDC_BLACKLISTED",
      complianceWallet: "0x00000000000000000000000000000000000000BB",
      error: null,
      step: "compliance_blocked",
      txHash: null,
    },
  };
}

function makeIdleAction(): DealAction {
  return {
    execute: async () => {},
    reset: () => {},
    state: {
      complianceReasonCode: null,
      complianceWallet: null,
      error: null,
      step: "idle",
      txHash: null,
    },
  };
}

function makeSyncFailedAction(): DealAction {
  return {
    execute: async () => {},
    reset: () => {},
    state: {
      complianceReasonCode: null,
      complianceWallet: null,
      error: "Transaction confirmed, but backend sync is delayed. Please refresh this page in a moment.",
      step: "sync_failed",
      txHash: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    },
  };
}

describe("DealActionsCard", () => {
  test("hides open dispute when buyerDisputable is false", () => {
    const html = renderToStaticMarkup(
      createElement(DealActionsCard, {
        autoRelease: makeIdleAction(),
        autoReleaseAvailable: false,
        buyerDisputable: false,
        buyerReleasable: true,
        complete: makeIdleAction(),
        dealStatus: "Funded",
        dispute: makeIdleAction(),
        isAnyActionInFlight: false,
        isBuyer: true,
        isSeller: false,
        onRefreshStatus: async () => null,
        release: makeIdleAction(),
        session: makeSession(),
      }),
    );

    assert.doesNotMatch(html, /Open dispute/);
  });

  test("renders a blocked notice for one action while leaving other actions available", () => {
    const html = renderToStaticMarkup(
      createElement(DealActionsCard, {
        autoRelease: makeIdleAction(),
        autoReleaseAvailable: false,
        buyerDisputable: true,
        buyerReleasable: true,
        complete: makeIdleAction(),
        dealStatus: "ConfirmPending",
        dispute: makeIdleAction(),
        isAnyActionInFlight: false,
        isBuyer: true,
        isSeller: false,
        onRefreshStatus: async () => null,
        release: makeBlockedAction(),
        session: makeSession(),
      }),
    );

    assert.match(html, /USDC blacklist blocked this action/);
    assert.match(html, /Open dispute/);
    assert.doesNotMatch(html, /Reset/);
    assert.doesNotMatch(html, /Confirm in wallet/);
  });

  test("renders refresh status for sync_failed while keeping the primary action disabled", () => {
    const html = renderToStaticMarkup(
      createElement(DealActionsCard, {
        autoRelease: makeIdleAction(),
        autoReleaseAvailable: false,
        buyerDisputable: false,
        buyerReleasable: true,
        complete: makeIdleAction(),
        dealStatus: "ConfirmPending",
        dispute: makeIdleAction(),
        isAnyActionInFlight: false,
        isBuyer: true,
        isSeller: false,
        onRefreshStatus: async () => null,
        release: makeSyncFailedAction(),
        session: makeSession(),
      }),
    );

    assert.match(html, /Refresh status/);
    assert.doesNotMatch(html, /Reset/);
    assert.match(html, /Transaction confirmed, but backend sync is delayed/);
    assert.match(html, /<button[^>]*disabled=""[^>]*>Release to seller<\/button>/);
  });
});
