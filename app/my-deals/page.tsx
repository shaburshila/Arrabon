"use client";

// /my-deals — Buyer's view of their paid consultation deals.
// Requires wallet connection + SIWE session.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchMyDeals, type MyDeal, type MyDealsFilter } from "@/lib/api/deals";
import { formatDate } from "@/lib/ui/date";
import { formatUsdcPrice } from "@/lib/ui/format";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { dealTrailingLabel } from "@/lib/ui/deal-trailing-label";
import { Icon } from "@/components/icons";
import { AppShell } from "@/components/app/app-shell";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Notice } from "@/components/shared/notice";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { SkeletonRows } from "@/components/shared/skeleton-rows";
import { StatusPill } from "@/components/shared/status-pill";
import { WalletAuthStatePanel } from "@/components/shared/wallet-auth-state-panel";

const PAGE_SIZE = 20;

const MY_DEALS_AUTH_MESSAGES = {
  checkingDescription: "Restoring your wallet session.",
  checkingTitle: "Checking session",
  connectDescription: "Connect to view your paid consultations.",
  connectTitle: "Connect your wallet",
  signInDescription: "Sign in with Ethereum to view your paid consultations.",
  signInTitle: "Sign in required",
  switchDescription: "Switch networks to view your paid consultations.",
  switchTitle: "Switch to Base",
} as const;

export default function MyDealsPage() {
  const session = useWalletSessionContext();
  const isAuthenticated =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated";

  const [deals, setDeals] = useState<MyDeal[] | null>(null);
  const [filter, setFilter] = useState<MyDealsFilter>("all");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const FILTERS = useMemo(
    () => [
      { value: "all" as const, label: `All${deals !== null ? ` · ${deals.length}` : ""}` },
      { value: "upcoming" as const, label: "Upcoming" },
      { value: "needs_action" as const, label: "Needs action" },
      { value: "disputed" as const, label: "Disputed" },
      { value: "resolved" as const, label: "Resolved" },
    ],
    [deals],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setDeals(null);
      setPage(0);
      setHasNextPage(false);
      return;
    }

    setLoading(true);
    setError(null);
    setDeals(null);
    fetchMyDeals({
      filter,
      limit: PAGE_SIZE + 1,
      offset: page * PAGE_SIZE,
    })
      .then((loadedDeals) => {
        setHasNextPage(loadedDeals.length > PAGE_SIZE);
        setDeals(loadedDeals.slice(0, PAGE_SIZE));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load deals."))
      .finally(() => setLoading(false));
  }, [filter, isAuthenticated, page]);

  function renderListContent() {
    if (deals === null) {
      return null;
    }

    if (filter === "all" && deals.length === 0 && !query) {
      return (
        <EmptyState
          description="Pay for a consultation link to see it here."
          icon={<Icon name="utility-wallet-connected" size={28} />}
          title="No paid consultations yet"
        />
      );
    }

    if (deals.length === 0) {
      return (
        <EmptyState
          action={
            query ? (
              <Btn size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Btn>
            ) : (
              <Btn size="sm" variant="ghost" onClick={() => { setFilter("all"); setPage(0); }}>Show all</Btn>
            )
          }
          description={query ? `No deals match "${query}".` : "Try another filter."}
          icon={<Icon name="utility-search" size={28} />}
          title="No matching deals"
        />
      );
    }

    const filtered = query.trim()
      ? deals.filter((d) =>
          `${d.title} ${d.id}`.toLowerCase().includes(query.toLowerCase().trim()),
        )
      : deals;

    if (filtered.length === 0) {
      return (
        <EmptyState
          action={<Btn size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Btn>}
          description={`No deals match "${query}".`}
          icon={<Icon name="utility-search" size={28} />}
          title="No matching deals"
        />
      );
    }

    return filtered.map((deal) => (
      <DealRow
        deal={deal}
        key={deal.id}
      />
    ));
  }

  if (!isAuthenticated) {
    return (
      <AppShell maxWidth={1180}>
        <WalletAuthStatePanel
          icon={<Icon name="utility-wallet-connected" size={32} />}
          messages={MY_DEALS_AUTH_MESSAGES}
          session={session}
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={1180}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 className="h1">My deals</h1>
          <p className="lede" style={{ marginTop: 8 }}>Consultations you've paid for as a buyer.</p>
        </div>
      </div>

      <div style={tabsRowStyle}>
        <SegmentedTabs
          onChange={(value) => {
            setFilter(value as MyDealsFilter);
            setPage(0);
          }}
          options={FILTERS}
          value={filter}
        />
        <div className="search-input">
          <span className="search-input__icon">
            <Icon name="utility-search" size={14} />
          </span>
          <input
            aria-label="Search by title or deal ID"
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or deal ID…"
            type="search"
            value={query}
          />
        </div>
      </div>

      {loading && (
        <ActionPanel style={listPanelStyle}>
          <SkeletonRows count={3} />
        </ActionPanel>
      )}

      {error && (
        <Notice
          message={error}
          title="Could not load deals"
          tone="danger"
        />
      )}

      {!loading && !error && deals !== null && (
        <>
          <ActionPanel style={listPanelStyle}>
            {renderListContent()}
          </ActionPanel>

          {deals.length > 0 && (
            <p style={footerCountStyle}>
              Page {page + 1} · {deals.length} shown
            </p>
          )}

          {(page > 0 || hasNextPage) && (
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

function DealRow({ deal }: { deal: MyDeal; isLast?: boolean }) {
  const badge = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });

  return (
    <Link href={`/deal/${deal.id}`} className="list-row">
      <div className="list-row__title">
        <span className="list-row__title-name">{deal.title}</span>
        <span className="list-row__title-sub">
          {formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
        </span>
      </div>
      <span className="list-row__price">
        {formatUsdcPrice(deal.price_usdc)}
        <span className="list-row__price-token">USDC</span>
      </span>
      <StatusPill bg={badge.bg} color={badge.color} icon={badge.icon} label={badge.label} />
      <span className="list-row__trailing">{dealTrailingLabel(deal.status)}</span>
      <span className="list-row__chevron">
        <Icon name="utility-chevron-right" size={16} />
      </span>
    </Link>
  );
}

const pageHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  justifyContent: "space-between",
  marginBottom: 32,
} as const;

const tabsRowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "space-between",
} as const;

const listPanelStyle = {
  overflow: "hidden",
} as const;

const footerCountStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "12px 0 0",
  textAlign: "center" as const,
} as const;
