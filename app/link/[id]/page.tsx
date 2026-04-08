"use client";

// /link/[id] — public link page + funding flow.
// Handles: display, wallet connect, SIWE, fund, post-fund polling, deal redirect.

import { useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { useLinkPage } from "@/hooks/use-link-page";
import { useFundingFlow } from "@/hooks/use-funding-flow";

import { LinkSummary } from "@/components/link/link-summary";
import { LinkActionCard } from "@/components/link/link-action-card";
import { FundingProgress } from "@/components/link/funding-progress";
import { StatusNotice } from "@/components/link/status-notice";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";

export default function LinkPage() {
  const params = useParams();
  const linkId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");
  const router = useRouter();

  const session = useWalletSession();
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

  // If link is already consumed + deal_id exists → redirect immediately
  useEffect(() => {
    if (
      linkPage.status === "ready" &&
      linkPage.link?.status === "Consumed" &&
      linkPage.link.deal_id
    ) {
      router.replace(`/deal/${linkPage.link.deal_id}`);
    }
  }, [linkPage.link, linkPage.status, router]);

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
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
            <StatusNotice type="consumed_indexing" />
          )}

        {/* Main content */}
        {linkPage.status === "ready" && linkPage.link && linkPage.link.status === "Open" && (
          <>
            <LinkSummary link={linkPage.link} />
            <WalletSessionCard session={session} />

            <LinkActionCard
              link={linkPage.link}
              role={linkPage.role}
              session={session}
              funding={funding}
            />

            {/* Funding progress — only shown while funding is active or failed */}
            {funding.state.step !== "idle" && (
              <FundingProgress
                error={funding.state.error}
                step={funding.state.step}
                txHash={funding.state.txHash}
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
