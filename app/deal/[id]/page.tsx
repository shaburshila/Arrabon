"use client";

// /deal/[id] — deal status page.
// Handles: deal info, reveal, complete/release/dispute lifecycle actions.

import { useParams } from "next/navigation";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { useDealPage } from "@/hooks/use-deal-page";
import { useDealActions } from "@/hooks/use-deal-action";

import { Icon } from "@/components/icons";
import { AppShell } from "@/components/app/app-shell";
import { DealStatusCard } from "@/components/deal/deal-status-card";
import { DealDetailsCard } from "@/components/deal/deal-details-card";
import { MeetingUrlCard } from "@/components/deal/meeting-url-card";
import { DealActionsCard } from "@/components/deal/deal-actions-card";
import { DisputeThread } from "@/components/deal/dispute-thread";
import { KeyTimes } from "@/components/deal/key-times";
import { ReceiptInset } from "@/components/deal/receipt-inset";
import { Countdown } from "@/components/shared/countdown";
import { Notice } from "@/components/shared/notice";
import type { DealReadModel } from "@/lib/api/deals";
import {
  isBuyerDisputable,
  isBuyerReleasable,
  isSellerAutoReleaseAvailable,
} from "@/lib/ui/deal-timing";

function shouldShowDisputeThread(status: string, resolvedFromStatus: string | null): boolean {
  return status === "Disputed" || resolvedFromStatus === "Disputed";
}

function getBackLink(input: { isBuyer: boolean; isSeller: boolean }) {
  if (input.isBuyer) {
    return { href: "/my-deals", label: "My deals" };
  }

  if (input.isSeller) {
    return { href: "/my-links", label: "My links" };
  }

  return { href: "/", label: "Home" };
}

function getRiskStatusNotice(deal: DealReadModel): { message: string; title: string } | null {
  if (deal.risk_status === "Blocked") {
    if (deal.status === "Released" || deal.status === "Refunded") {
      return {
        message: "This deal was flagged during compliance review. The completed outcome is shown for transparency.",
        title: "Compliance Flag",
      };
    }

    return {
      message: "This deal is under compliance review. Payouts are temporarily paused until the hold is resolved.",
      title: "Compliance Hold",
    };
  }

  if (deal.risk_status === "Review") {
    if (deal.status === "Released" || deal.status === "Refunded") {
      return {
        message: "This deal was flagged for compliance review. The current status remains visible for transparency.",
        title: "Compliance Review",
      };
    }

    return {
      message: "This deal is under compliance review. Some actions may be delayed while checks are completed.",
      title: "Compliance Review",
    };
  }

  return null;
}

export default function DealPage() {
  const params = useParams();
  const dealId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const session = useWalletSessionContext();
  const dealPage = useDealPage(dealId, session.address, session.siweStatus);
  const actions = useDealActions(
    dealId,
    dealPage.deal?.consultation_link_id ?? "",
    dealPage.refetch,
  );
  const backLink = getBackLink({
    isBuyer: dealPage.isBuyer,
    isSeller: dealPage.isSeller,
  });
  const riskStatusNotice =
    dealPage.status === "ready" && dealPage.deal
      ? getRiskStatusNotice(dealPage.deal)
      : null;

  return (
    <AppShell maxWidth={1180}>
      <Link
        href={backLink.href}
        className="btn btn--quiet btn--sm"
        style={{ alignSelf: "flex-start", marginBottom: 16 }}
      >
        <Icon name="utility-arrow-left" size={14} />
        Back to {backLink.label.toLowerCase()}
      </Link>

      {dealPage.status === "loading" && (
        <div style={centerStyle}>
          <p className="small">Loading deal…</p>
        </div>
      )}
      {dealPage.status === "not_found" && <Notice message="Deal not found." tone="muted" />}
      {dealPage.status === "auth_required" && (
        <Notice
          message="Connect your wallet and sign in with Ethereum to view this deal."
          title="Sign in required"
          tone="muted"
        />
      )}
      {dealPage.status === "access_denied" && (
        <Notice
          message="Access denied. This deal is only visible to its participants."
          tone="muted"
        />
      )}
      {dealPage.status === "error" && (
        <Notice message={dealPage.error ?? "Failed to load deal."} tone="danger" />
      )}

      {dealPage.status === "ready" && dealPage.deal && (
        <>
          {dealPage.isStale && (
            <Notice
              message="Deal status may be outdated right now. We're having trouble refreshing it."
              title="Refresh delayed"
              tone="warning"
            />
          )}
          {riskStatusNotice && (
            <Notice
              message={riskStatusNotice.message}
              title={riskStatusNotice.title}
              tone={dealPage.deal.risk_status === "Blocked" ? "danger" : "warning"}
            />
          )}

          <DealStatusCard
            deal={dealPage.deal}
            isAdmin={session.session?.is_admin === true}
            isBuyer={dealPage.isBuyer}
            isSeller={dealPage.isSeller}
            isParticipant={dealPage.isParticipant}
          />

          {(dealPage.deal.status === "Funded" || dealPage.deal.status === "ConfirmPending") && (
            <div className="deal-countdown">
              <span className="deal-countdown__icon">
                <Icon name="utility-time" size={14} />
              </span>
              {dealPage.deal.status === "Funded" && (
                <>
                  <span className="deal-countdown__label">Consultation starts</span>
                  <span className="deal-countdown__value">
                    <Countdown to={dealPage.deal.scheduled_at} prefix="in" expiredLabel="now — join the meeting" />
                  </span>
                </>
              )}
              {dealPage.deal.status === "ConfirmPending" && (
                <>
                  <span className="deal-countdown__label">
                    {dealPage.isBuyer ? "Confirm or dispute" : "Auto-release"}
                  </span>
                  <span className="deal-countdown__value">
                    <Countdown to={dealPage.deal.release_deadline_at ?? ""} prefix="in" expiredLabel="deadline passed" />
                  </span>
                </>
              )}
              <span className="live-dot" style={{ marginLeft: "auto" }} />
              <span style={{ color: "var(--muted)", fontSize: 13 }}>Live</span>
            </div>
          )}

          <div className="deal-split">
            <div className="deal-split__left">
              <KeyTimes deal={dealPage.deal} isSeller={dealPage.isSeller} />
              <MeetingUrlCard
                dealId={dealId}
                dealStatus={dealPage.deal.status}
                isParticipant={dealPage.isParticipant}
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
            </div>

            <aside className="deal-split__right">
              <DealDetailsCard deal={dealPage.deal} role={dealPage.role} />
              <DealActionsCard
                autoRelease={actions.autoRelease}
                autoReleaseAvailable={isSellerAutoReleaseAvailable({
                  durationMinutes: dealPage.deal.duration_minutes,
                  isSeller: dealPage.isSeller,
                  scheduledAt: dealPage.deal.scheduled_at,
                  status: dealPage.deal.status,
                })}
                buyerDisputable={isBuyerDisputable({
                  durationMinutes: dealPage.deal.duration_minutes,
                  scheduledAt: dealPage.deal.scheduled_at,
                  status: dealPage.deal.status,
                })}
                buyerReleasable={isBuyerReleasable({
                  durationMinutes: dealPage.deal.duration_minutes,
                  scheduledAt: dealPage.deal.scheduled_at,
                  status: dealPage.deal.status,
                })}
                complete={actions.complete}
                dealStatus={dealPage.deal.status}
                dispute={actions.dispute}
                isAnyActionInFlight={actions.isAnyActionInFlight}
                isBuyer={dealPage.isBuyer}
                isSeller={dealPage.isSeller}
                onRefreshStatus={dealPage.refetch}
                release={actions.release}
                scheduledAt={dealPage.deal.scheduled_at}
                session={session}
              />
              <ReceiptInset
                dealId={dealId}
                visible={
                  dealPage.deal.status === "Released" || dealPage.deal.status === "Refunded"
                }
              />
            </aside>
          </div>
        </>
      )}
    </AppShell>
  );
}

const centerStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: 200,
} as const;

