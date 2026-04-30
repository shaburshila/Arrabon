"use client";

// /my-deals — Buyer recovery surface for paid consultations.
// Requires wallet connection + SIWE session.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  Briefcase,
  Clock,
  Eye,
  User,
} from "lucide-react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchMyDeals, type MyDeal, type MyDealsFilter } from "@/lib/api/deals";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { AppShell } from "@/components/app/app-shell";
import { ActionPanel } from "@/components/shared/action-panel";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Notice } from "@/components/shared/notice";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
import { StatusPill } from "@/components/shared/status-pill";
import { WalletAuthStatePanel } from "@/components/shared/wallet-auth-state-panel";

const FILTERS: { value: MyDealsFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "needs_action", label: "Needs action" },
  { value: "disputed", label: "Disputed" },
  { value: "resolved", label: "Resolved" },
];

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
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (filter === "all" && (!deals || deals.length === 0)) {
      return (
        <EmptyState
          description="Pay for a consultation link to see it here."
          icon={<Briefcase size={36} />}
          title="No paid consultations yet"
        />
      );
    }

    if (!deals || deals.length === 0) {
      return (
        <EmptyState
          description="Try another filter."
          icon={<Briefcase size={36} />}
          title="No matching deals"
        />
      );
    }

    return deals.map((deal, index) => (
      <DealRow
        deal={deal}
        isLast={index === deals.length - 1}
        key={deal.id}
      />
    ));
  }

  if (!isAuthenticated) {
    return (
      <AppShell maxWidth={672}>
        <WalletAuthStatePanel
          icon={<Briefcase size={40} />}
          messages={MY_DEALS_AUTH_MESSAGES}
          session={session}
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={672}>
      <div style={pageHeaderStyle}>
        <h1 style={h1Style}>My deals</h1>
      </div>

      <SegmentedTabs
        onChange={(value) => {
          setFilter(value as MyDealsFilter);
          setPage(0);
        }}
        options={FILTERS}
        value={filter}
      />

      {loading && (
        <ActionPanel style={listPanelStyle}>
          <DealSkeletonRows />
        </ActionPanel>
      )}

      {error && (
        <Notice
          message={error}
          title="Could not load deals"
          tone="danger"
        />
      )}

      {!loading && !error && (
        <>
          <ActionPanel style={listPanelStyle}>
            {renderListContent()}
          </ActionPanel>

          {deals && deals.length > 0 && (
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

function DealSkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div
          key={item}
          style={{
            ...rowStyle,
            borderBottom: item === 2 ? "none" : "1px solid var(--subtle-border)",
          }}
        >
          <div style={{ ...rowIconStyle, color: "transparent" }} />
          <div style={rowInfoStyle}>
            <div style={{ ...skeletonLineStyle, width: "55%" }} />
            <div style={{ ...skeletonLineStyle, marginTop: 8, width: "44%" }} />
          </div>
          <div style={{ ...skeletonLineStyle, width: 72 }} />
          <div style={{ ...skeletonLineStyle, width: 68 }} />
          <div style={{ ...skeletonLineStyle, width: 32 }} />
        </div>
      ))}
    </>
  );
}

function DealRow({
  deal,
  isLast,
}: {
  deal: MyDeal;
  isLast: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const badge = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...rowStyle,
        background: isHovered ? "var(--panel-hover)" : "transparent",
        borderBottom: isLast ? "none" : "1px solid var(--subtle-border)",
      }}
    >
      <div style={rowIconStyle}>
        <Briefcase size={15} />
      </div>

      <div style={rowInfoStyle}>
        <p style={rowTitleStyle}>{deal.title}</p>
        <div style={rowMetaStyle}>
          <span style={metaItemStyle}>
            <User size={10} />
            {truncateAddress(deal.seller_address)}
          </span>
          <span style={metaItemStyle}>
            <Clock size={10} />
            {formatDate(deal.scheduled_at, { timeZone: deal.timezone })}
          </span>
        </div>
      </div>

      <p style={priceStyle}>{deal.price_usdc} USDC</p>

      <StatusPill
        bg={badge.bg}
        color={badge.color}
        label={badge.label}
      />

      <IconNextLink
        href={`/deal/${deal.id}`}
        label="View deal"
      >
        <Eye size={13} />
      </IconNextLink>
    </div>
  );
}

function IconNextLink({
  children,
  href,
  label,
}: {
  children: ReactNode;
  href: string;
  label: string;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      aria-label={label}
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={iconActionStyle(isHovered)}
      title={label}
    >
      {children}
    </Link>
  );
}

function iconActionStyle(isHovered: boolean): CSSProperties {
  return {
    alignItems: "center",
    background: isHovered ? "var(--muted-bg)" : "transparent",
    border: "none",
    borderRadius: "var(--radius-sm)",
    color: "var(--muted)",
    cursor: "pointer",
    display: "inline-flex",
    flexShrink: 0,
    height: 32,
    justifyContent: "center",
    padding: 6,
    textDecoration: "none",
    transition: "background 0.15s, color 0.15s",
    width: 32,
  };
}

const pageHeaderStyle = {
  alignItems: "center",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
} as const;

const h1Style = {
  color: "var(--foreground)",
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: 0,
} as const;

const listPanelStyle = {
  overflow: "hidden",
} as const;

const skeletonLineStyle = {
  background: "var(--muted-bg)",
  borderRadius: 999,
  height: 12,
} as const;

const rowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  padding: "16px 20px",
  transition: "background 0.15s",
} as const;

const rowIconStyle = {
  alignItems: "center",
  background: "var(--muted-bg)",
  borderRadius: "var(--radius)",
  color: "var(--muted)",
  display: "inline-flex",
  flexShrink: 0,
  height: 36,
  justifyContent: "center",
  width: 36,
} as const;

const rowInfoStyle = {
  flex: "1 1 220px",
  minWidth: 0,
} as const;

const rowTitleStyle = {
  color: "var(--foreground)",
  fontSize: 14,
  fontWeight: 500,
  margin: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap" as const,
} as const;

const rowMetaStyle = {
  alignItems: "center",
  color: "var(--muted)",
  display: "flex",
  flexWrap: "wrap" as const,
  fontSize: 12,
  gap: 12,
  marginTop: 4,
} as const;

const metaItemStyle = {
  alignItems: "center",
  display: "inline-flex",
  gap: 4,
} as const;

const priceStyle = {
  color: "var(--foreground)",
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 600,
  margin: 0,
} as const;

const footerCountStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "12px 0 0",
  textAlign: "center" as const,
} as const;
