"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Hex } from "viem";
import { useConfig } from "wagmi";

import { shouldShowFlaggedDeal } from "@/app/admin/disputes/ui";
import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { ApiError } from "@/lib/api/auth";
import {
  type AdminDealReview,
  type AdminResolvedDealReview,
  type AdminResolution,
  fetchAdminDisputedDeals,
  fetchAdminResolvedDeals,
  prepareAdminResolve,
} from "@/lib/api/admin-deals";
import { fetchDeal, type DealStatus } from "@/lib/api/deals";
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
import { ListPagination } from "@/components/shared/list-pagination";
import { Notice } from "@/components/shared/notice";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";

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

const PAGE_SIZE = 20;
const VIEW_OPTIONS = [
  { label: "Open disputes", value: "open" },
  { label: "Resolved history", value: "resolved" },
] as const;
type AdminDisputesView = (typeof VIEW_OPTIONS)[number]["value"];

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

export default function AdminDisputesPage() {
  const config = useConfig();
  const session = useWalletSessionContext();
  const [view, setView] = useState<AdminDisputesView>("open");
  const [deals, setDeals] = useState<AdminDealReview[]>([]);
  const [resolvedDeals, setResolvedDeals] = useState<AdminResolvedDealReview[]>([]);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);
  const [confirming, setConfirming] = useState<{
    dealId: string;
    resolution: AdminResolution;
  } | null>(null);
  const [resolveState, setResolveState] = useState<ResolveState>(emptyResolveState);
  const lockRef = useRef(false);

  const canLoadAdminDeals =
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

  const loadDeals = useCallback(async () => {
    if (!canLoadAdminDeals) {
      setPage(0);
      setHasNextPage(false);
      setDeals([]);
      setResolvedDeals([]);
      return;
    }

    setLoading(true);
    setLoadError(null);
    if (view === "resolved") {
      setResolvedDeals([]);
    } else {
      setDeals([]);
    }

    try {
      if (view === "resolved") {
        const loadedDeals = await fetchAdminResolvedDeals({
          limit: PAGE_SIZE + 1,
          offset: page * PAGE_SIZE,
        });
        setHasNextPage(loadedDeals.length > PAGE_SIZE);
        setResolvedDeals(loadedDeals.slice(0, PAGE_SIZE));
      } else {
        const loadedDeals = await fetchAdminDisputedDeals({
          limit: PAGE_SIZE + 1,
          offset: page * PAGE_SIZE,
        });
        setHasNextPage(loadedDeals.length > PAGE_SIZE);
        setDeals(loadedDeals.slice(0, PAGE_SIZE));
      }
    } catch (error) {
      setLoadError(
        error instanceof ApiError
          ? error.message
          : error instanceof Error
            ? error.message
            : view === "resolved"
              ? "Failed to load resolved disputes."
              : "Failed to load disputes.",
      );
    } finally {
      setLoading(false);
    }
  }, [canLoadAdminDeals, page, view]);

  useEffect(() => {
    void loadDeals();
  }, [loadDeals]);

  useEffect(() => {
    setPage(0);
    setHasNextPage(false);
    setLoadError(null);
    setConfirming(null);
    setResolveState(emptyResolveState);
  }, [view]);

  const syncUntilConverged = useCallback(
    async (
      deal: AdminDealReview,
      txHash: Hex,
      expectedStatus: DealStatus,
    ): Promise<boolean> => {
      const MAX_ATTEMPTS = 40;
      const RETRY_INTERVAL_MS = 2_000;

      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
        const syncResult = await triggerFundingSync(
          deal.consultation_link_id,
          txHash,
        ).catch((error) => {
          console.warn("Admin dispute sync trigger failed after confirmed tx.", {
            attempt,
            dealId: deal.id,
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

        const latestDeal = await fetchDeal(deal.id).catch(() => null);

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
    async (deal: AdminDealReview, resolution: AdminResolution) => {
      if (lockRef.current || isResolving) {
        return;
      }

      lockRef.current = true;
      setResolveState({
        dealId: deal.id,
        error: null,
        resolution,
        step: "preparing",
        txHash: null,
      });

      try {
        const prepared = await prepareAdminResolve(deal.id, resolution);
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
          deal,
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
        await loadDeals();
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
    [config, isResolving, loadDeals, syncUntilConverged],
  );

  const visibleOpenDeals = useMemo(
    () => deals.filter((deal) => shouldShowFlaggedDeal(deal.risk_status, showOnlyFlagged)),
    [deals, showOnlyFlagged],
  );
  const visibleResolvedDeals = useMemo(
    () =>
      resolvedDeals.filter((deal) => shouldShowFlaggedDeal(deal.risk_status, showOnlyFlagged)),
    [resolvedDeals, showOnlyFlagged],
  );
  const visibleCount = view === "resolved" ? visibleResolvedDeals.length : visibleOpenDeals.length;

  return (
    <AppShell maxWidth={860}>
      <div style={headerStyle}>
        <h1 style={h1Style}>Disputes</h1>
        <p style={subtitleStyle}>
          Review disputed escrow deals and prepare the admin resolution transaction.
        </p>
        <Link href="/admin/denylist" style={adminLinkStyle}>
          Open compliance denylist →
        </Link>
      </div>

      <WalletSessionCard session={session} />

      {isSessionLoading && (
        <Notice
          message="Checking wallet session. Disputes will load automatically once access is restored."
          tone="muted"
        />
      )}

      {session.siweStatus === "authenticated" && session.session?.is_admin !== true && (
        <Notice message="This wallet is not on the admin allowlist." tone="danger" />
      )}

      {canLoadAdminDeals && (
        <>
          <SegmentedTabs
            onChange={(nextValue) => {
              if (isResolving) {
                return;
              }

              setView(nextValue as AdminDisputesView);
            }}
            options={VIEW_OPTIONS.map((option) => ({ ...option }))}
            value={view}
          />

          <div style={toolbarStyle}>
            <div style={toolbarLeftStyle}>
              <span style={countStyle}>Page {page + 1} · {visibleCount} shown</span>
              <label style={filterLabelStyle}>
                <input
                  checked={showOnlyFlagged}
                  disabled={loading}
                  onChange={(event) => setShowOnlyFlagged(event.target.checked)}
                  type="checkbox"
                />
                <span>Show only flagged</span>
              </label>
            </div>
            <button
              disabled={loading || isResolving}
              onClick={loadDeals}
              style={smallButtonStyle}
              type="button"
            >
              Refresh
            </button>
          </div>

          {loading && (
            <AdminDisputeSkeletonList />
          )}

          {loadError && (
            <Notice message={loadError} tone="danger" />
          )}

          {!loading && !loadError && view === "open" && visibleOpenDeals.length === 0 && (
            <Notice message="No open disputes." tone="muted" />
          )}

          {!loading && !loadError && view === "resolved" && visibleResolvedDeals.length === 0 && (
            <Notice message="No resolved disputes yet." tone="muted" />
          )}

          {view === "open" && (
            <div style={listStyle}>
              {visibleOpenDeals.map((deal) => {
              const activeForDeal = resolveState.dealId === deal.id;
              const activeText = activeForDeal ? statusText(resolveState) : null;
              const confirmForDeal = confirming?.dealId === deal.id ? confirming : null;

              return (
                <ActionPanel as="section" key={deal.id} style={dealCardStyle}>
                  <div style={dealHeaderStyle}>
                    <div>
                      <h2 style={dealTitleStyle}>{deal.title}</h2>
                      <p style={metaStyle}>Deal #{deal.onchain_deal_id}</p>
                      <Link href={`/admin/disputes/${deal.id}`} style={detailLinkStyle}>
                        View dispute
                      </Link>
                    </div>
                    <div style={badgeStackStyle}>
                      <StatusPill label="Disputed" size="md" tone="danger" />
                      <RiskBadge riskStatus={deal.risk_status} size="md" />
                    </div>
                  </div>

                  <div style={gridStyle}>
                    <Info label="Risk" value={deal.risk_status} />
                    <Info label="Price" value={`${deal.price_usdc} USDC`} />
                    <Info
                      label="Scheduled"
                      value={formatDate(deal.scheduled_at, {
                        fallback: "Not set",
                        timeZone: deal.timezone,
                      })}
                    />
                    <Info
                      label="Completed"
                      value={formatDate(deal.completed_at, {
                        fallback: "Not set",
                        showTimeZoneName: true,
                      })}
                    />
                    <Info
                      label="Release deadline"
                      value={formatDate(deal.release_deadline_at, {
                        fallback: "Not set",
                        showTimeZoneName: true,
                      })}
                    />
                    <Info label="Buyer" value={truncateAddress(deal.buyer_address)} />
                    <Info label="Seller" value={truncateAddress(deal.seller_address)} />
                  </div>

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

                  {confirmForDeal ? (
                    <div style={confirmStyle}>
                      <p style={confirmTextStyle}>
                        {confirmForDeal.resolution === "release"
                          ? `Release ${deal.price_usdc} USDC to seller?`
                          : `Refund ${deal.price_usdc} USDC to buyer?`}
                      </p>
                      <div style={actionsStyle}>
                        <Btn
                          disabled={isResolving}
                          onClick={() => resolveDeal(deal, confirmForDeal.resolution)}
                          variant={confirmForDeal.resolution === "release" ? "primary" : "danger"}
                        >
                          {actionLabel(confirmForDeal.resolution)}
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
                        disabled={isResolving}
                        onClick={() => setConfirming({ dealId: deal.id, resolution: "release" })}
                        variant="primary"
                      >
                        Release to seller
                      </Btn>
                      <Btn
                        disabled={isResolving}
                        onClick={() => setConfirming({ dealId: deal.id, resolution: "refund" })}
                        variant="danger"
                      >
                        Refund to buyer
                      </Btn>
                    </div>
                  )}

                  <DisputeThread
                    canPost={canLoadAdminDeals}
                    canView={canLoadAdminDeals}
                    compact
                    currentWallet={session.address}
                    dealId={deal.id}
                    dealStatus={deal.status}
                    embedded
                  />
                </ActionPanel>
              );
              })}
            </div>
          )}

          {view === "resolved" && (
            <div style={listStyle}>
              {visibleResolvedDeals.map((deal) => (
                <ActionPanel as="section" key={deal.id} style={dealCardStyle}>
                  <div style={dealHeaderStyle}>
                    <div>
                      <h2 style={dealTitleStyle}>{deal.title}</h2>
                      <p style={metaStyle}>Deal #{deal.onchain_deal_id}</p>
                    </div>
                    <div style={badgeStackStyle}>
                      <StatusPill
                        label={deal.status === "Released" ? "Released" : "Refunded"}
                        size="md"
                        tone={deal.status === "Released" ? "success" : "accent"}
                      />
                      <RiskBadge riskStatus={deal.risk_status} size="md" />
                    </div>
                  </div>

                  <div style={gridStyle}>
                    <Info label="Risk" value={deal.risk_status} />
                    <Info label="Price" value={`${deal.price_usdc} USDC`} />
                    <Info
                      label="Decision"
                      value={formatResolutionDecision(deal.resolution_type)}
                    />
                    <Info
                      label="Resolved at"
                      value={formatDate(deal.resolved_at, {
                        fallback: "Not set",
                        showTimeZoneName: true,
                      })}
                    />
                    <Info
                      label="Resolved by"
                      value={
                        deal.resolved_by_wallet
                          ? truncateAddress(deal.resolved_by_wallet)
                          : "Not set"
                      }
                    />
                    <Info
                      label="Funding tx"
                      value={deal.tx_hash ? truncateTxHash(deal.tx_hash) : "Not set"}
                    />
                    <Info label="Buyer" value={truncateAddress(deal.buyer_address)} />
                    <Info label="Seller" value={truncateAddress(deal.seller_address)} />
                  </div>
                </ActionPanel>
              ))}
            </div>
          )}

          {!loading && !loadError && (page > 0 || hasNextPage) && (
            <ListPagination
              currentPage={page}
              hasNextPage={hasNextPage}
              onNext={() => setPage((value) => value + 1)}
              onPrevious={() => setPage((value) => Math.max(0, value - 1))}
            />
          )}
        </>
      )}
    </AppShell>
  );
}

function AdminDisputeSkeletonList() {
  return (
    <div style={listStyle}>
      {[0, 1].map((item) => (
        <ActionPanel as="section" key={item} style={dealCardStyle}>
          <div style={dealHeaderStyle}>
            <div style={{ flex: 1 }}>
              <div style={{ ...skeletonLineStyle, width: "42%" }} />
              <div style={{ ...skeletonLineStyle, marginTop: 10, width: "24%" }} />
            </div>
            <div style={{ ...skeletonLineStyle, width: 86 }} />
          </div>

          <div style={gridStyle}>
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} style={infoStyle}>
                <div style={{ ...skeletonLineStyle, marginBottom: 8, width: "38%" }} />
                <div style={{ ...skeletonLineStyle, width: "72%" }} />
              </div>
            ))}
          </div>

          <div style={actionsStyle}>
            <div style={{ ...skeletonLineStyle, height: 44, width: 140 }} />
            <div style={{ ...skeletonLineStyle, height: 44, width: 140 }} />
          </div>
        </ActionPanel>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
    </div>
  );
}

function truncateTxHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function formatResolutionDecision(
  value: AdminResolvedDealReview["resolution_type"],
): string {
  if (value === "admin_refund") {
    return "Refund";
  }

  if (value === "admin_release") {
    return "Release";
  }

  if (value === "auto_release") {
    return "Auto-release";
  }

  if (value === "buyer_confirmed") {
    return "Buyer confirmed";
  }

  return "Not set";
}

const headerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const h1Style = {
  fontSize: 32,
  lineHeight: 1.1,
  margin: 0,
};

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
};

const adminLinkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
};

const toolbarStyle = {
  alignItems: "center",
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
};

const toolbarLeftStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
};

const countStyle = {
  color: "var(--muted)",
  fontSize: 13,
  fontWeight: 600,
};

const filterLabelStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "inline-flex",
  fontSize: 13,
  gap: 8,
};

const listStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const skeletonLineStyle = {
  background: "var(--muted-bg)",
  borderRadius: 999,
  height: 12,
} as const;

const dealCardStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 16,
  padding: 20,
};

const dealHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 12,
  justifyContent: "space-between",
};

const badgeStackStyle = {
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const dealTitleStyle = {
  fontSize: 18,
  lineHeight: 1.3,
  margin: "0 0 4px",
  overflowWrap: "anywhere" as const,
};

const metaStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: 0,
};

const detailLinkStyle = {
  color: "var(--accent)",
  display: "inline-block",
  fontSize: 13,
  fontWeight: 600,
  marginTop: 8,
  textDecoration: "none",
} as const;

const gridStyle = {
  display: "grid",
  gap: 10,
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
};

const infoStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 4,
  minWidth: 0,
  padding: 12,
};

const infoLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
};

const infoValueStyle = {
  fontSize: 14,
  fontWeight: 600,
  overflowWrap: "anywhere" as const,
};

const actionsStyle = {
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 8,
};

const confirmStyle = {
  background: "var(--panel-muted)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  padding: 12,
};

const confirmTextStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  margin: 0,
};

const txStyle = {
  fontSize: 12,
  marginTop: 6,
  overflowWrap: "anywhere" as const,
};

const smallButtonStyle = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  minHeight: 36,
  padding: "0 12px",
};
