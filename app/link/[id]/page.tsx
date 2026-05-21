"use client";

// /link/[id] — public link page + funding flow.
// Handles: display, wallet connect, SIWE, fund, post-fund polling, deal redirect.

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { useLinkPage } from "@/hooks/use-link-page";
import { useFundingFlow } from "@/hooks/use-funding-flow";
import {
  shouldShowConsumedLinkPrivateNotice,
} from "@/app/link/[id]/consumed-link-state";

import { Icon } from "@/components/icons";
import { LinkSummary } from "@/components/link/link-summary";
import { LinkActionCard } from "@/components/link/link-action-card";
import { StatusNotice } from "@/components/link/status-notice";
import { ArrabonSeal } from "@/components/shared/arrabon-seal";
import { Notice } from "@/components/shared/notice";

export default function LinkPage() {
  const params = useParams();
  const linkId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");
  const router = useRouter();

  const session = useWalletSessionContext();
  const linkPage = useLinkPage(linkId, session.address);

  const handleDealIndexed = useCallback(
    (dealId: string) => {
      router.push(`/deal/${dealId}`);
    },
    [router],
  );

  const funding = useFundingFlow(
    linkId,
    handleDealIndexed,
    linkPage.startDealIdPolling,
  );

  const handleRetryPolling = useCallback(() => {
    const txHash = funding.state.txHash ?? undefined;

    linkPage.stopPolling();
    funding.retryIndexing();
    linkPage.startDealIdPolling(
      handleDealIndexed,
      funding.handlePollingTimeout,
      funding.handleSyncStatus,
      txHash,
    );
  }, [funding, handleDealIndexed, linkPage]);

  const handleBack = useCallback(() => {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push("/");
  }, [router]);

  // If the current viewer has a local funding tx and the consumed link already has a deal,
  // redirect them into their private recovery path.
  useEffect(() => {
    if (
      linkPage.status === "ready" &&
      linkPage.link?.status === "Consumed" &&
      linkPage.link.deal_id &&
      funding.state.txHash !== null
    ) {
      linkPage.stopPolling();
      router.replace(`/deal/${linkPage.link.deal_id}`);
    }
  }, [funding.state.txHash, linkPage.link, linkPage.status, linkPage.stopPolling, router]);

  return (
    <main className="link-page">
      <div className="link-page__inner">
        <div className="link-page__topbar">
          <Link href="/" style={brandStyle}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Arrabon" height={28} src="/alpha-lock-full-gold.svg" width={28} />
            <span style={brandWordStyle}>Arrabon</span>
          </Link>
          <button onClick={handleBack} className="btn btn--quiet btn--sm" type="button">
            <Icon name="utility-arrow-left" size={14} />
            Back
          </button>
        </div>

        {linkPage.status === "loading" && (
          <div style={centerStyle}>
            <p className="small" role="status" aria-live="polite">Loading…</p>
          </div>
        )}

        {linkPage.status === "not_found" && <StatusNotice type="not_found" />}
        {linkPage.status === "error" && (
          <StatusNotice type="error" message={linkPage.error ?? undefined} />
        )}
        {linkPage.status === "unavailable" && (
          <StatusNotice
            type={linkPage.unavailableReason === "Expired" ? "expired" : "cancelled"}
          />
        )}

        {linkPage.status === "ready" &&
          linkPage.link?.status === "Consumed" &&
          !linkPage.link.deal_id &&
          funding.state.txHash !== null && (
            <>
              <StatusNotice type="consumed_indexing" />
              <div style={indexingRetryCardStyle}>
                <Notice
                  message="We are checking automatically. You can retry the check manually if it takes too long."
                  tone="info"
                />
                <button
                  onClick={handleRetryPolling}
                  style={indexingRetryButtonStyle}
                  type="button"
                >
                  Retry check
                </button>
              </div>
            </>
          )}

        {linkPage.status === "ready" &&
          shouldShowConsumedLinkPrivateNotice({
            dealId: linkPage.link?.deal_id ?? null,
            status: linkPage.link?.status,
            txHash: funding.state.txHash,
          }) && <StatusNotice type="consumed_private" />}

        {linkPage.status === "ready" && linkPage.link && linkPage.link.status === "Open" && (
          <div className="link-split">
            <LinkSummary link={linkPage.link} />
            <aside className="link-split__right">
              <LinkActionCard
                dealIdPollingTimedOut={linkPage.dealIdPollingTimedOut}
                link={linkPage.link}
                onRetryPolling={handleRetryPolling}
                role={linkPage.role}
                session={session}
                funding={funding}
              />
              <div style={insetSealCardStyle}>
                <ArrabonSeal size={48} tone="auto" />
                <div>
                  <p className="tiny">Secured by Arrabon</p>
                  <p style={insetSealDescStyle}>Onchain escrow on Base. Trusted settlement.</p>
                </div>
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}

const brandStyle = {
  alignItems: "center",
  color: "var(--ink)",
  display: "inline-flex",
  gap: 10,
  textDecoration: "none",
} as const;

const brandWordStyle = {
  fontFamily: "var(--font-serif)",
  fontSize: 22,
  fontWeight: 500,
  letterSpacing: "0.005em",
} as const;

const insetSealCardStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border-soft)",
  borderRadius: "var(--r-3)",
  display: "flex",
  gap: 14,
  padding: 28,
} as const;

const insetSealDescStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: "4px 0 0",
};

const centerStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "center",
  minHeight: 200,
} as const;

const indexingRetryCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
} as const;

const indexingRetryButtonStyle = {
  alignSelf: "flex-start",
  background: "none",
  border: "none",
  color: "var(--gold-deep)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
} as const;
