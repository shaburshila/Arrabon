"use client";

// /link/[id] — public link page + funding flow.
// Handles: display, wallet connect, SIWE, fund, post-fund polling, deal redirect.

import { useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { useLinkPage } from "@/hooks/use-link-page";
import { useFundingFlow } from "@/hooks/use-funding-flow";

import { LinkSummary } from "@/components/link/link-summary";
import { LinkActionCard } from "@/components/link/link-action-card";
import { StatusNotice } from "@/components/link/status-notice";
import { Notice } from "@/components/shared/notice";

export default function LinkPage() {
  const params = useParams();
  const linkId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");
  const router = useRouter();

  const session = useWalletSession();
  const linkPage = useLinkPage(linkId, session.address);
  const consumedIndexingPollingStartedRef = useRef(false);

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

  // If link is already consumed + deal_id exists → redirect immediately
  useEffect(() => {
    if (
      linkPage.status === "ready" &&
      linkPage.link?.status === "Consumed" &&
      linkPage.link.deal_id
    ) {
      linkPage.stopPolling();
      router.replace(`/deal/${linkPage.link.deal_id}`);
    }
  }, [linkPage.link, linkPage.status, linkPage.stopPolling, router]);

  useEffect(() => {
    const shouldPollConsumedLink =
      linkPage.status === "ready" &&
      linkPage.link?.status === "Consumed" &&
      !linkPage.link.deal_id &&
      funding.state.step === "idle";

    if (!shouldPollConsumedLink) {
      if (linkPage.link?.status !== "Consumed" || linkPage.link.deal_id) {
        consumedIndexingPollingStartedRef.current = false;
      }
      return;
    }

    if (consumedIndexingPollingStartedRef.current) {
      return;
    }

    consumedIndexingPollingStartedRef.current = true;
    linkPage.startDealIdPolling(handleDealIndexed);
  }, [
    funding.state.step,
    handleDealIndexed,
    linkPage,
  ]);

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        <div style={pageHeaderStyle}>
          <Link href="/" style={brandStyle}>
            Base Consult Link
          </Link>
          <button onClick={handleBack} style={backButtonStyle} type="button">
            ← Back
          </button>
        </div>

        {/* Loading */}
        {linkPage.status === "loading" && (
          <div style={centerStyle}>
            <p style={{ color: "var(--muted)", fontSize: 14 }}>Loading…</p>
          </div>
        )}

        {/* Not found */}
        {linkPage.status === "not_found" && (
          <StatusNotice type="not_found" />
        )}

        {/* Error */}
        {linkPage.status === "error" && (
          <StatusNotice type="error" message={linkPage.error ?? undefined} />
        )}

        {/* Unavailable (expired / cancelled) */}
        {linkPage.status === "unavailable" && (
          <StatusNotice
            type={linkPage.unavailableReason === "Expired" ? "expired" : "cancelled"}
          />
        )}

        {/* Consumed but deal_id not yet available (indexing lag) */}
        {linkPage.status === "ready" &&
          linkPage.link?.status === "Consumed" &&
          !linkPage.link.deal_id && (
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

        {/* Main content */}
        {linkPage.status === "ready" && linkPage.link && linkPage.link.status === "Open" && (
          <>
            <LinkSummary link={linkPage.link} />

            <LinkActionCard
              dealIdPollingTimedOut={linkPage.dealIdPollingTimedOut}
              link={linkPage.link}
              onRetryPolling={handleRetryPolling}
              role={linkPage.role}
              session={session}
              funding={funding}
            />
          </>
        )}
      </div>
    </main>
  );
}

const mainStyle = {
  background: "var(--background)",
  display: "flex",
  justifyContent: "center",
  minHeight: "100vh",
  padding: "20px 16px 48px",
} as const;

const pageStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  maxWidth: 520,
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
  minHeight: 36,
} as const;

const brandStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  fontWeight: 800,
  letterSpacing: "-0.01em",
  textDecoration: "none",
} as const;

const backLinkStyle = {
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
} as const;

const backButtonStyle = {
  ...backLinkStyle,
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
} as const;

const indexingRetryCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 10,
} as const;

const retryButtonStyle = {
  alignSelf: "flex-start",
  background: "none",
  border: "none",
  color: "var(--danger)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
} as const;

const indexingRetryButtonStyle = {
  ...retryButtonStyle,
  color: "var(--accent)",
} as const;
