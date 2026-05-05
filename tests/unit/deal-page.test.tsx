import { beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

function makeEntry(id: string, exports: unknown) {
  return {
    children: [],
    exports,
    filename: id,
    id,
    loaded: true,
    path: path.dirname(id),
    parent: null,
    paths: [],
    require,
  } as any;
}

const root = path.resolve(__dirname, "../..");
const nextNavigationPath = require.resolve("next/navigation");
const nextLinkPath = require.resolve("next/link");
const walletSessionContextPath = path.resolve(root, "contexts/wallet-session-context.tsx");
const useDealPagePath = path.resolve(root, "hooks/use-deal-page.ts");
const useDealActionPath = path.resolve(root, "hooks/use-deal-action.ts");
const appShellPath = path.resolve(root, "components/app/app-shell.tsx");
const dealStatusCardPath = path.resolve(root, "components/deal/deal-status-card.tsx");
const meetingUrlCardPath = path.resolve(root, "components/deal/meeting-url-card.tsx");
const dealGuidanceCardPath = path.resolve(root, "components/deal/deal-guidance-card.tsx");
const disputeThreadPath = path.resolve(root, "components/deal/dispute-thread.tsx");
const keyTimesPath = path.resolve(root, "components/deal/key-times.tsx");
const walletSessionCardPath = path.resolve(root, "components/shared/wallet-session-card.tsx");
const liveBadgePath = path.resolve(root, "components/shared/live-badge.tsx");
const noticePath = path.resolve(root, "components/shared/notice.tsx");

const idleAction = {
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

const session = {
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
  siweStatus: "authenticated" as const,
  switchToCorrectChain: async () => {},
};

const mocks = {
  params: { id: "deal-id-1" },
  session,
  dealPage: {
    deal: {
      buyer_address: "0x00000000000000000000000000000000000000AA",
      completed_at: null,
      consultation_link_id: "link-id-1",
      id: "deal-id-1",
      onchain_deal_id: "1",
      price_usdc: "100.00",
      release_deadline_at: null,
      resolved_at: null,
      resolved_by_wallet: null,
      resolved_from_status: null,
      risk_status: "Clear" as const,
      scheduled_at: "2026-05-06T12:00:00.000Z",
      seller_address: "0x00000000000000000000000000000000000000BB",
      status: "Funded" as const,
      tx_hash: null,
      resolution_type: null,
    },
    error: null,
    isBuyer: true,
    isParticipant: true,
    isSeller: false,
    refetch: async () => null,
    role: "buyer",
    status: "ready" as const,
  },
  actions: {
    autoRelease: idleAction,
    complete: idleAction,
    dispute: idleAction,
    isAnyActionInFlight: false,
    release: idleAction,
  },
};

(require.cache as Record<string, unknown>)[nextNavigationPath] = makeEntry(nextNavigationPath, {
  useParams: () => mocks.params,
});
(require.cache as Record<string, unknown>)[nextLinkPath] = makeEntry(nextLinkPath, {
  __esModule: true,
  default: ({ children, href }: { children: unknown; href: string }) =>
    createElement("a", { href }, children as any),
});
(require.cache as Record<string, unknown>)[walletSessionContextPath] = makeEntry(walletSessionContextPath, {
  useWalletSessionContext: () => mocks.session,
});
(require.cache as Record<string, unknown>)[useDealPagePath] = makeEntry(useDealPagePath, {
  useDealPage: () => mocks.dealPage,
});
(require.cache as Record<string, unknown>)[useDealActionPath] = makeEntry(useDealActionPath, {
  useDealActions: () => mocks.actions,
});
(require.cache as Record<string, unknown>)[appShellPath] = makeEntry(appShellPath, {
  AppShell: ({ children }: { children: unknown }) => createElement("div", null, children as any),
});
(require.cache as Record<string, unknown>)[dealStatusCardPath] = makeEntry(dealStatusCardPath, {
  DealStatusCard: () => createElement("div", null, "status-card"),
});
(require.cache as Record<string, unknown>)[meetingUrlCardPath] = makeEntry(meetingUrlCardPath, {
  MeetingUrlCard: () => createElement("div", null, "meeting-card"),
});
(require.cache as Record<string, unknown>)[dealGuidanceCardPath] = makeEntry(dealGuidanceCardPath, {
  DealGuidanceCard: () => createElement("div", null, "guidance-card"),
});
(require.cache as Record<string, unknown>)[disputeThreadPath] = makeEntry(disputeThreadPath, {
  DisputeThread: () => createElement("div", null, "dispute-thread"),
});
(require.cache as Record<string, unknown>)[keyTimesPath] = makeEntry(keyTimesPath, {
  KeyTimes: () => createElement("div", null, "key-times"),
});
(require.cache as Record<string, unknown>)[walletSessionCardPath] = makeEntry(walletSessionCardPath, {
  WalletSessionCard: () => createElement("div", null, "wallet-card"),
});
(require.cache as Record<string, unknown>)[liveBadgePath] = makeEntry(liveBadgePath, {
  LiveBadge: () => createElement("div", null, "live-badge"),
});
(require.cache as Record<string, unknown>)[noticePath] = makeEntry(noticePath, {
  Notice: ({ message }: { message: unknown }) => createElement("div", null, message as any),
});

const { default: DealPage } = require("../../app/deal/[id]/page");

describe("DealPage funded dispute timing", () => {
  beforeEach(() => {
    mocks.dealPage.deal = {
      ...mocks.dealPage.deal,
      scheduled_at: "2026-05-06T12:00:00.000Z",
      status: "Funded",
    };
  });

  test("hides open dispute before scheduled_at", () => {
    const originalNow = Date.now;
    Date.now = () => new Date("2026-05-06T11:00:00.000Z").getTime();

    try {
      const html = renderToStaticMarkup(createElement(DealPage));
      assert.doesNotMatch(html, /Open dispute/);
    } finally {
      Date.now = originalNow;
    }
  });

  test("shows open dispute at scheduled_at boundary", () => {
    const originalNow = Date.now;
    Date.now = () => new Date("2026-05-06T12:00:00.000Z").getTime();

    try {
      const html = renderToStaticMarkup(createElement(DealPage));
      assert.match(html, /Open dispute/);
    } finally {
      Date.now = originalNow;
    }
  });
});
