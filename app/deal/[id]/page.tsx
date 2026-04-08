"use client";

// /deal/[id] — deal status page.
// Handles: deal info, reveal, complete/release/dispute lifecycle actions.

import { useParams } from "next/navigation";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { useDealPage } from "@/hooks/use-deal-page";
import { useDealActions } from "@/hooks/use-deal-action";

import { DealStatusCard } from "@/components/deal/deal-status-card";
import { MeetingUrlCard } from "@/components/deal/meeting-url-card";
import { DealActionsCard } from "@/components/deal/deal-actions-card";
import { KeyTimes } from "@/components/deal/key-times";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";

// Buyer can dispute from Funded (no-show) or ConfirmPending (within window)
function isBuyerDisputable(status: string): boolean {
  return status === "Funded" || status === "ConfirmPending";
}

export default function DealPage() {
  const params = useParams();
  const dealId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const session = useWalletSession();
  const dealPage = useDealPage(dealId, session.address);
  const actions = useDealActions(dealId, dealPage.refetch);

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        {/* Loading */}
        {dealPage.status === "loading" && (
          <div style={centerStyle}>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading deal…</p>
          </div>
        )}

        {/* Not found */}
        {dealPage.status === "not_found" && (
          <div
            style={{
              background: "var(--muted-bg)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              color: "var(--muted)",
              fontSize: 14,
              padding: 20,
            }}
          >
            Deal not found.
          </div>
        )}

        {/* Error */}
        {dealPage.status === "error" && (
          <div
            style={{
              background: "var(--danger-muted)",
              border: "1px solid var(--danger)",
              borderRadius: "var(--radius)",
              color: "var(--danger)",
              fontSize: 14,
              padding: 20,
            }}
          >
            {dealPage.error ?? "Failed to load deal."}
          </div>
        )}

        {/* Main content */}
        {dealPage.status === "ready" && dealPage.deal && (
          <>
            <DealStatusCard deal={dealPage.deal} />
            <WalletSessionCard session={session} />
            <KeyTimes deal={dealPage.deal} />

            <MeetingUrlCard
              dealId={dealId}
              dealStatus={dealPage.deal.status}
              isParticipant={dealPage.isParticipant}
              session={session}
            />

            <DealActionsCard
              buyerDisputable={isBuyerDisputable(dealPage.deal.status)}
              complete={actions.complete}
              dealStatus={dealPage.deal.status}
              dispute={actions.dispute}
              isBuyer={dealPage.isBuyer}
              isSeller={dealPage.isSeller}
              release={actions.release}
              session={session}
            />
          </>
        )}
      </div>
    </main>
  );
}

const mainStyle = {
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "24px 16px 48px",
} as const;

const pageStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  maxWidth: 480,
  width: "100%",
};

const centerStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: 200,
} as const;
