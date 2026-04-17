"use client";

// /deal/[id] — deal status page.
// Handles: deal info, reveal, complete/release/dispute lifecycle actions.

import { useParams } from "next/navigation";
import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { useDealPage } from "@/hooks/use-deal-page";
import { useDealActions } from "@/hooks/use-deal-action";

import { DealStatusCard } from "@/components/deal/deal-status-card";
import { MeetingUrlCard } from "@/components/deal/meeting-url-card";
import { DealActionsCard } from "@/components/deal/deal-actions-card";
import { DealGuidanceCard } from "@/components/deal/deal-guidance-card";
import { DisputeThread } from "@/components/deal/dispute-thread";
import { KeyTimes } from "@/components/deal/key-times";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";
import { LiveBadge } from "@/components/shared/live-badge";
import { isDealStatusPollable } from "@/lib/api/deals";

// Buyer can dispute from Funded (no-show) or ConfirmPending (within window)
function isDeadlinePassed(value: string | null): boolean {
  if (!value) {
    return false;
  }

  const deadlineMs = new Date(value).getTime();

  return !Number.isNaN(deadlineMs) && Date.now() > deadlineMs;
}

function isBuyerDisputable(status: string, releaseDeadlineAt: string | null): boolean {
  if (status === "Funded") {
    return true;
  }

  return status === "ConfirmPending" && !isDeadlinePassed(releaseDeadlineAt);
}

function isBuyerReleasable(status: string, releaseDeadlineAt: string | null): boolean {
  return status === "ConfirmPending" && !isDeadlinePassed(releaseDeadlineAt);
}

function isAutoReleaseAvailable(status: string, releaseDeadlineAt: string | null): boolean {
  return status === "ConfirmPending" && isDeadlinePassed(releaseDeadlineAt);
}

function shouldShowDisputeThread(status: string, resolvedFromStatus: string | null): boolean {
  return status === "Disputed" || resolvedFromStatus === "Disputed";
}

export default function DealPage() {
  const params = useParams();
  const dealId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const session = useWalletSession();
  const dealPage = useDealPage(dealId, session.address);
  const actions = useDealActions(
    dealId,
    dealPage.deal?.consultation_link_id ?? "",
    dealPage.refetch,
  );

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        <div style={pageHeaderStyle}>
          <Link href="/" style={brandStyle}>
            Base Consult Link
          </Link>
          {dealPage.status === "ready" && dealPage.deal && isDealStatusPollable(dealPage.deal.status) && (
            <LiveBadge />
          )}
        </div>

        <Link href="/my-links" style={backLinkStyle}>
          ← My links
        </Link>

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
            <DealStatusCard deal={dealPage.deal} role={dealPage.role} />
            <DealGuidanceCard
              dealStatus={dealPage.deal.status}
              isBuyer={dealPage.isBuyer}
              isSeller={dealPage.isSeller}
              isViewer={!dealPage.isParticipant}
              priceUsdc={dealPage.deal.price_usdc}
              releaseDeadlineAt={dealPage.deal.release_deadline_at}
              scheduledAt={dealPage.deal.scheduled_at}
            />
            <WalletSessionCard session={session} />
            <KeyTimes deal={dealPage.deal} isSeller={dealPage.isSeller} />

            <MeetingUrlCard
              dealId={dealId}
              dealStatus={dealPage.deal.status}
              isParticipant={dealPage.isParticipant}
              session={session}
            />

            <DealActionsCard
              autoRelease={actions.autoRelease}
              autoReleaseAvailable={isAutoReleaseAvailable(
                dealPage.deal.status,
                dealPage.deal.release_deadline_at,
              )}
              buyerDisputable={isBuyerDisputable(
                dealPage.deal.status,
                dealPage.deal.release_deadline_at,
              )}
              buyerReleasable={isBuyerReleasable(
                dealPage.deal.status,
                dealPage.deal.release_deadline_at,
              )}
              complete={actions.complete}
              dealStatus={dealPage.deal.status}
              dispute={actions.dispute}
              isAnyActionInFlight={actions.isAnyActionInFlight}
              isBuyer={dealPage.isBuyer}
              isSeller={dealPage.isSeller}
              release={actions.release}
              session={session}
            />

            {shouldShowDisputeThread(
              dealPage.deal.status,
              dealPage.deal.resolved_from_status,
            ) && (
              <DisputeThread
                canPost={
                  dealPage.deal.status === "Disputed" &&
                  session.siweStatus === "authenticated" &&
                  (dealPage.isParticipant || session.session?.is_admin === true)
                }
                canView={
                  session.siweStatus === "authenticated" &&
                  (dealPage.isParticipant || session.session?.is_admin === true)
                }
                currentWallet={session.address}
                dealId={dealId}
                dealStatus={dealPage.deal.status}
              />
            )}
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

const pageHeaderStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
} as const;

const brandStyle = {
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.1em",
  textDecoration: "none",
  textTransform: "uppercase" as const,
} as const;

const backLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
} as const;
