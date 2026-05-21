"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { useConfig } from "wagmi";

import { getAdminResolveAvailability } from "@/app/admin/disputes/ui";
import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { ApiError } from "@/lib/api/auth";
import type { AdminComplianceCheck, AdminDealCompliance } from "@/lib/api/admin";
import { fetchAdminDealCompliance } from "@/lib/api/admin";
import {
  type AdminDealReview,
  type AdminResolution,
  exchangeAdminResolve,
  fetchAdminDeal,
  prepareAdminResolve,
} from "@/lib/api/admin-deals";
import { fetchDeal, type DealStatus } from "@/lib/api/deals";
import type { DealRiskStatus } from "@/lib/db/types";
import { triggerFundingSync } from "@/lib/api/links";
import { executeAdminCall, waitForTx } from "@/lib/contract/execute-prepared-call";
import { truncateAddress } from "@/lib/ui/address";
import { wait } from "@/lib/ui/async";
import { formatDate } from "@/lib/ui/date";
import { AppShell } from "@/components/app/app-shell";
import { RiskBadge } from "@/components/admin/risk-badge";
import { DisputeThread } from "@/components/deal/dispute-thread";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { DetailRow } from "@/components/shared/detail-row";
import { Notice } from "@/components/shared/notice";
import { StatusPill } from "@/components/shared/status-pill";

type ResolveStep =
  | "failed"
  | "idle"
  | "pending_chain"
  | "preparing"
  | "signature"
  | "sync_failed"
  | "syncing_backend"
  | "succeeded";

interface ResolveState {
  dealId: string | null;
  error: string | null;
  resolution: AdminResolution | null;
  step: ResolveStep;
  txHash: Hex | null;
}

const emptyResolveState: ResolveState = {
  dealId: null,
  error: null,
  resolution: null,
  step: "idle",
  txHash: null,
};

function expectedStatusForResolution(resolution: AdminResolution): DealStatus {
  return resolution === "release" ? "Released" : "Refunded";
}

function actionLabel(resolution: AdminResolution) {
  return resolution === "release" ? "Release to seller" : "Refund to buyer";
}

function statusText(state: ResolveState) {
  switch (state.step) {
    case "preparing":
      return "Preparing contract call...";
    case "signature":
      return "Waiting for admin wallet signature...";
    case "pending_chain":
      return "Transaction submitted. Waiting for confirmation...";
    case "syncing_backend":
      return "Confirmed. Syncing deal status...";
    case "succeeded":
      return "Resolved.";
    case "sync_failed":
      return state.error ?? "Confirmed, but backend sync is delayed.";
    case "failed":
      return state.error ?? "Action failed.";
    default:
      return null;
  }
}

function resolveNoticeTone(
  step: ResolveStep,
): "danger" | "info" | "muted" | "success" {
  if (step === "failed" || step === "sync_failed") {
    return "danger";
  }

  if (step === "succeeded") {
    return "success";
  }

  return "info";
}

function DetailValue({
  children,
  mono = false,
}: {
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <span
      style={{
        fontFamily: mono ? "var(--font-mono), monospace" : undefined,
        overflowWrap: "anywhere",
      }}
    >
      {children}
    </span>
  );
}

export default function AdminDisputeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const config = useConfig();
  const dealId = typeof params.id === "string" ? params.id : (params.id?.[0] ?? "");

  const session = useWalletSessionContext();
  const pathname = usePathname();
  const isDisputes = pathname.startsWith("/admin/disputes");
  const isDenylist = pathname.startsWith("/admin/denylist");
  const [deal, setDeal] = useState<AdminDealReview | null>(null);
  const [compliance, setCompliance] = useState<AdminDealCompliance | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<AdminResolution | null>(null);
  const [acknowledgedReviewRisk, setAcknowledgedReviewRisk] = useState(false);
  const [resolveState, setResolveState] = useState<ResolveState>(emptyResolveState);
  const lockRef = useRef(false);

  const canLoadAdminDeal =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated" &&
    session.session?.is_admin === true;
  const isSessionLoading = session.siweStatus === "loading";

  const isResolving = useMemo(() => {
    return (
      resolveState.step !== "idle" &&
      resolveState.step !== "failed" &&
      resolveState.step !== "succeeded" &&
      resolveState.step !== "sync_failed"
    );
  }, [resolveState.step]);

  const loadDeal = useCallback(async () => {
    if (!canLoadAdminDeal || !dealId) {
      setDeal(null);
      setCompliance(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const [loadedDeal, loadedCompliance] = await Promise.all([
        fetchAdminDeal(dealId),
        fetchAdminDealCompliance(dealId),
      ]);
      setDeal(loadedDeal);
      setCompliance(loadedCompliance);
      setAcknowledgedReviewRisk(false);
      setConfirming(null);
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : "Failed to load dispute.",
      );
      setDeal(null);
      setCompliance(null);
    } finally {
      setLoading(false);
    }
  }, [canLoadAdminDeal, dealId]);

  useEffect(() => {
    void loadDeal();
  }, [loadDeal]);

  const syncUntilConverged = useCallback(
    async (
      currentDeal: AdminDealReview,
      txHash: Hex,
      expectedStatus: DealStatus,
    ): Promise<boolean> => {
      const MAX_ATTEMPTS = 40;
      const RETRY_INTERVAL_MS = 2_000;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const syncResult = await triggerFundingSync(
          currentDeal.consultation_link_id,
          txHash,
        ).catch((error) => {
          console.warn("Admin dispute detail sync trigger failed after confirmed tx.", {
            attempt,
            dealId: currentDeal.id,
            error,
            txHash,
          });

          return {
            code: "ADMIN_SYNC_TRIGGER_FAILED",
            error: "Backend sync is temporarily unavailable.",
            ok: false as const,
            status: "retryable" as const,
          };
        });

        if (!syncResult.ok && syncResult.status === "fatal" && syncResult.code !== "DEAL_NOT_FOUND_FOR_TX") {
          setResolveState((prev) => ({
            ...prev,
            error: "Transaction confirmed, but backend indexing is unavailable. Refresh later.",
            step: "sync_failed",
          }));

          return false;
        }

        const latestDeal = await fetchDeal(currentDeal.id).catch(() => null);

        if (latestDeal?.status === expectedStatus) {
          return true;
        }

        if (attempt < MAX_ATTEMPTS) {
          await wait(RETRY_INTERVAL_MS);
        }
      }

      setResolveState((prev) => ({
        ...prev,
        error: "Transaction confirmed, but backend sync is delayed. Refresh in a moment.",
        step: "sync_failed",
      }));

      return false;
    },
    [],
  );

  const resolveDeal = useCallback(
    async (currentDeal: AdminDealReview, resolution: AdminResolution) => {
      if (lockRef.current || isResolving) {
        return;
      }

      lockRef.current = true;
      setResolveState({
        dealId: currentDeal.id,
        error: null,
        resolution,
        step: "preparing",
        txHash: null,
      });

      try {
        const grant = await prepareAdminResolve(currentDeal.id, resolution);
        const prepared = await exchangeAdminResolve(currentDeal.id, grant.grant_token);
        setResolveState((prev) => ({ ...prev, step: "signature" }));

        const hash = await executeAdminCall(config, prepared.contract_call);
        setResolveState((prev) => ({
          ...prev,
          step: "pending_chain",
          txHash: hash,
        }));

        await waitForTx(config, hash);
        setResolveState((prev) => ({ ...prev, step: "syncing_backend" }));

        const converged = await syncUntilConverged(
          currentDeal,
          hash,
          expectedStatusForResolution(resolution),
        );

        if (!converged) {
          return;
        }

        setResolveState((prev) => ({
          ...prev,
          error: null,
          step: "succeeded",
        }));
        setConfirming(null);
        router.push("/admin/disputes");
      } catch (error) {
        setResolveState((prev) => ({
          ...prev,
          error:
            error instanceof ApiError
              ? error.message
              : error instanceof Error
                ? error.message
                : "Failed to resolve dispute.",
          step: "failed",
        }));
      } finally {
        lockRef.current = false;
      }
    },
    [config, isResolving, router, syncUntilConverged],
  );

  const activeText = deal && resolveState.dealId === deal.id ? statusText(resolveState) : null;
  const riskStatus = compliance?.risk_status ?? deal?.risk_status ?? "Clear";
  const resolveAvailability = getAdminResolveAvailability(riskStatus, acknowledgedReviewRisk);

  return (
    <AppShell maxWidth={1180}>
      <nav className="admin-subnav">
        <div className="admin-subnav__brand">
          <span className="admin-badge">Admin</span>
        </div>
        <div className="admin-subnav__tabs">
          <Link
            href="/admin/disputes"
            className={`admin-subnav__tab${isDisputes ? " is-active" : ""}`}
          >
            Disputes
          </Link>
          <Link
            href="/admin/denylist"
            className={`admin-subnav__tab${isDenylist ? " is-active" : ""}`}
          >
            Denylist
          </Link>
        </div>
      </nav>

      <Link href="/admin/disputes" style={backLinkStyle}>
        ← Back to disputes
      </Link>

      <div style={headerStyle}>
        <h1 style={h1Style}>Dispute detail</h1>
        <p style={subtitleStyle}>
          Review the full dispute record, conversation, and admin resolution options.
        </p>
      </div>

      {isSessionLoading && (
        <Notice
          message="Checking wallet session. Dispute details will load automatically once access is restored."
          tone="muted"
        />
      )}

      {session.siweStatus === "authenticated" && session.session?.is_admin !== true && (
        <Notice message="This wallet does not have admin permissions." tone="danger" />
      )}

      {canLoadAdminDeal && (
        <>
          <div style={toolbarStyle}>
            <span style={countStyle}>Dispute ID: {dealId}</span>
            <button
              disabled={loading || isResolving}
              onClick={loadDeal}
              style={smallButtonStyle}
              type="button"
            >
              Refresh
            </button>
          </div>

          {loading && <Notice message="Loading dispute..." tone="muted" />}

          {loadError && (
            <Notice message={loadError} tone="danger" />
          )}

          {!loading && !loadError && deal && (
            <div style={pageStackStyle}>
              <ActionPanel as="section" style={sectionStyle}>
                <div style={dealHeaderStyle}>
                  <div>
                    <h2 style={dealTitleStyle}>{deal.title}</h2>
                    <p style={metaStyle}>Deal #{deal.onchain_deal_id}</p>
                  </div>
                  <div style={badgeStackStyle}>
                    <StatusPill label="Disputed" size="md" tone="danger" />
                    <RiskBadge riskStatus={riskStatus} size="md" />
                  </div>
                </div>

                <div style={rowsStyle}>
                  <DetailRow label="Record ID" value={<DetailValue mono>{deal.id}</DetailValue>} />
                  <DetailRow
                    label="Onchain deal ID"
                    value={<DetailValue mono>{deal.onchain_deal_id}</DetailValue>}
                  />
                  <DetailRow label="Price" value={`${deal.price_usdc} USDC`} />
                  <DetailRow label="Status" value={deal.status} />
                  <DetailRow label="Risk status" value={riskStatus} />
                  <DetailRow
                    label="Buyer"
                    value={<DetailValue mono>{truncateAddress(deal.buyer_address)}</DetailValue>}
                  />
                  <DetailRow
                    label="Seller"
                    value={<DetailValue mono>{truncateAddress(deal.seller_address)}</DetailValue>}
                  />
                  <DetailRow
                    label="Scheduled"
                    value={formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
                  />
                  <DetailRow
                    label="Completed"
                    value={formatDate(deal.completed_at, {
                      fallback: "Not set",
                      showTimeZoneName: true,
                    })}
                  />
                  <DetailRow
                    label="Release deadline"
                    value={formatDate(deal.release_deadline_at, {
                      fallback: "Not set",
                      showTimeZoneName: true,
                    })}
                  />
                  <DetailRow label="Timezone" value={deal.timezone} />
                  <DetailRow label="Duration" value={`${deal.duration_minutes} min`} />
                  <DetailRow
                    label="Expires"
                    value={formatDate(deal.expires_at, {
                      showTimeZoneName: true,
                      timeZone: deal.timezone,
                    })}
                  />
                  <DetailRow
                    bordered={false}
                    label="Funding tx"
                    value={
                      deal.tx_hash ? (
                        <DetailValue mono>{deal.tx_hash}</DetailValue>
                      ) : (
                        "Not set"
                      )
                    }
                  />
                </div>
              </ActionPanel>

              <ActionPanel as="section" style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <h2 style={sectionTitleStyle}>Resolution metadata</h2>
                </div>
                <div style={rowsStyle}>
                  <DetailRow
                    label="Resolution"
                    value={deal.resolution_type ?? "Not set"}
                  />
                  <DetailRow
                    label="Resolved at"
                    value={formatDate(deal.resolved_at, {
                      fallback: "Not set",
                      showTimeZoneName: true,
                    })}
                  />
                  <DetailRow
                    label="Resolved by wallet"
                    value={
                      deal.resolved_by_wallet ? (
                        <DetailValue mono>{truncateAddress(deal.resolved_by_wallet)}</DetailValue>
                      ) : (
                        "Not set"
                      )
                    }
                  />
                  <DetailRow
                    label="Resolved from status"
                    value={deal.resolved_from_status ?? "Not set"}
                  />
                  <DetailRow
                    bordered={false}
                    label="Released at"
                    value={formatDate(deal.released_at, {
                      fallback: "Not set",
                      showTimeZoneName: true,
                    })}
                  />
                </div>
              </ActionPanel>

              <ActionPanel as="section" style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <h2 style={sectionTitleStyle}>Admin resolution</h2>
                  <p style={sectionDescriptionStyle}>
                    Resolve the open dispute and sync the final status back into the app.
                  </p>
                </div>

                {riskStatus === "Blocked" && (
                  <Notice
                    message="Funds in legal hold. Do not resolve this dispute until cleared by counsel. Both release and refund may constitute an OFAC violation."
                    title="Legal hold"
                    tone="danger"
                  />
                )}

                {riskStatus === "Review" && (
                  <Notice
                    message="This deal is flagged for review. Acknowledge the risk before resolving the dispute."
                    title="Manual review required"
                    tone="warning"
                  />
                )}

                {activeText && (
                  <Notice
                    message={
                      <>
                        {activeText}
                        {resolveState.txHash && (
                          <div style={txStyle}>Tx: {resolveState.txHash}</div>
                        )}
                      </>
                    }
                    tone={resolveNoticeTone(resolveState.step)}
                  />
                )}

                {riskStatus === "Review" && (
                  <label style={acknowledgeLabelStyle}>
                    <input
                      checked={acknowledgedReviewRisk}
                      onChange={(event) => setAcknowledgedReviewRisk(event.target.checked)}
                      type="checkbox"
                    />
                    <span>I understand the compliance review risk and want to continue.</span>
                  </label>
                )}

                {confirming ? (
                  <div style={confirmStyle}>
                    <p style={confirmTextStyle}>
                      {confirming === "release"
                        ? `Release ${deal.price_usdc} USDC to seller?`
                        : `Refund ${deal.price_usdc} USDC to buyer?`}
                    </p>
                    <div style={actionsStyle}>
                      <Btn
                        disabled={isResolving || resolveAvailability.disabled}
                        disabledReason={
                          !isResolving ? resolveAvailability.disabledReason ?? undefined : undefined
                        }
                        onClick={() => resolveDeal(deal, confirming)}
                        variant={confirming === "release" ? "primary" : "danger"}
                      >
                        {actionLabel(confirming)}
                      </Btn>
                      <Btn
                        disabled={isResolving}
                        onClick={() => setConfirming(null)}
                        variant="ghost"
                      >
                        Cancel
                      </Btn>
                    </div>
                  </div>
                ) : (
                  <div style={actionsStyle}>
                    <Btn
                      disabled={isResolving || resolveAvailability.disabled}
                      disabledReason={
                        !isResolving ? resolveAvailability.disabledReason ?? undefined : undefined
                      }
                      onClick={() => setConfirming("release")}
                      variant="primary"
                    >
                      Release to seller
                    </Btn>
                    <Btn
                      disabled={isResolving || resolveAvailability.disabled}
                      disabledReason={
                        !isResolving ? resolveAvailability.disabledReason ?? undefined : undefined
                      }
                      onClick={() => setConfirming("refund")}
                      variant="danger"
                    >
                      Refund to buyer
                    </Btn>
                  </div>
                )}
              </ActionPanel>

              <ActionPanel as="section" style={sectionStyle}>
                <div style={sectionHeaderStyle}>
                  <h2 style={sectionTitleStyle}>Compliance checks</h2>
                  <p style={sectionDescriptionStyle}>
                    Review provider results, wallets, and timestamps before taking an admin action.
                  </p>
                </div>

                {compliance && compliance.checks.length > 0 ? (
                  <div style={checksListStyle}>
                    {compliance.checks.map((check) => (
                      <ComplianceCheckItem key={check.id} check={check} />
                    ))}
                  </div>
                ) : (
                  <Notice message="No compliance checks recorded for this deal." tone="muted" />
                )}
              </ActionPanel>

              <DisputeThread
                canPost={canLoadAdminDeal}
                canView={canLoadAdminDeal}
                currentWallet={session.address}
                dealId={deal.id}
                dealStatus={deal.status}
              />
            </div>
          )}
        </>
      )}
    </AppShell>
  );
}

function ComplianceCheckItem({ check }: { check: AdminComplianceCheck }) {
  return (
    <div style={checkCardStyle}>
      <DetailRow label="Provider" value={check.provider} />
      <DetailRow label="Result" value={check.result} />
      <DetailRow label="Reason" value={check.reason_code} />
      <DetailRow
        label="Checked at"
        value={formatDate(check.checked_at, {
          fallback: "Not set",
          showTimeZoneName: true,
        })}
      />
      <DetailRow
        bordered={false}
        label="Wallet"
        value={<DetailValue mono>{truncateAddress(check.subject_value)}</DetailValue>}
      />
    </div>
  );
}

const pageStackStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
} as const;

const backLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
} as const;

const headerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
} as const;

const h1Style = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: "0 0 4px",
} as const;

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
} as const;

const toolbarStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
} as const;

const countStyle = {
  color: "var(--muted)",
  fontSize: 13,
} as const;

const smallButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 36,
  padding: "0 12px",
} as const;

const sectionStyle = {
  padding: 20,
} as const;

const dealHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 14,
  justifyContent: "space-between",
  marginBottom: 16,
} as const;

const badgeStackStyle = {
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
} as const;

const dealTitleStyle = {
  fontSize: 22,
  lineHeight: 1.2,
  margin: 0,
} as const;

const metaStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: "6px 0 0",
} as const;

const sectionHeaderStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 6,
  marginBottom: 12,
} as const;

const sectionTitleStyle = {
  fontSize: 18,
  lineHeight: 1.25,
  margin: 0,
} as const;

const sectionDescriptionStyle = {
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
} as const;

const rowsStyle = {
  display: "flex",
  flexDirection: "column" as const,
} as const;

const txStyle = {
  fontFamily: "var(--font-mono), monospace",
  fontSize: 12,
  marginTop: 6,
  overflowWrap: "anywhere" as const,
} as const;

const confirmStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
} as const;

const confirmTextStyle = {
  fontSize: 14,
  margin: 0,
} as const;

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 10,
} as const;

const acknowledgeLabelStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  gap: 8,
} as const;

const checksListStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
} as const;

const checkCardStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 12,
} as const;
