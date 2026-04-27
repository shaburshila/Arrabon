import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { LinkActionCard } from "@/components/link/link-action-card";
import type { FundingFlow } from "@/hooks/use-funding-flow";
import type { WalletSessionState } from "@/hooks/use-wallet-session";
import type { PublicLink } from "@/lib/api/links";

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

function makeFunding(): FundingFlow {
  return {
    execute: async () => {},
    handlePollingTimeout: () => {},
    handleSyncStatus: () => true,
    reset: () => {},
    retryIndexing: () => {},
    state: {
      complianceReasonCode: "LOCAL_DENYLIST",
      complianceWallet: "0x00000000000000000000000000000000000000AA",
      error: null,
      step: "compliance_blocked",
      txHash: null,
    },
  };
}

function makeLink(): PublicLink {
  return {
    deal_id: null,
    description: "Desc",
    duration_minutes: 60,
    expires_at: "2026-04-28T10:00:00.000Z",
    id: "link-id-1",
    meeting_url_revealed: false,
    price_usdc: "100.00",
    scheduled_at: "2026-04-28T12:00:00.000Z",
    seller_address: "0x00000000000000000000000000000000000000BB",
    status: "Open",
    timezone: "UTC",
    title: "Consult",
  };
}

describe("LinkActionCard", () => {
  test("renders compliance notice without retry controls for blocked funding", () => {
    const html = renderToStaticMarkup(
      createElement(LinkActionCard, {
        dealIdPollingTimedOut: false,
        funding: makeFunding(),
        link: makeLink(),
        onRetryPolling: () => {},
        role: "viewer",
        session: makeSession(),
      }),
    );

    assert.match(html, /Local compliance policy blocked this action/);
    assert.match(html, /0x0000\.\.\.00AA/);
    assert.doesNotMatch(html, /Try again/);
    assert.doesNotMatch(html, /Payment progress/);
  });
});
