"use client";

// /my-links — Seller's view of their consultation links.
// Requires wallet connection + SIWE session.

import { useEffect, useState, type CSSProperties } from "react";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchMyLinks, type MyLink, type MyLinksFilter } from "@/lib/api/links";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { formatDate } from "@/lib/ui/date";
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

type MyLinkBadge = {
  bg: string;
  color: string;
  label: string;
};

const FILTERS: { value: MyLinksFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "available", label: "Available" },
  { value: "upcoming", label: "Upcoming" },
  { value: "awaiting_buyer", label: "Awaiting buyer" },
  { value: "disputed", label: "Disputed" },
  { value: "closed", label: "Closed" },
  { value: "inactive", label: "Inactive" },
];

const PAGE_SIZE = 20;

const MY_LINKS_AUTH_MESSAGES = {
  checkingDescription: "Restoring your wallet session.",
  checkingTitle: "Checking session",
  connectDescription: "Connect to view and manage your consultation links.",
  connectTitle: "Connect your wallet",
  signInDescription: "Sign in with Ethereum to view your consultation links.",
  signInTitle: "Sign in required",
  switchDescription: "Switch networks to view your consultation links.",
  switchTitle: "Switch to Base",
} as const;

const LINK_STATUS_CONFIG: Record<MyLink["status"], MyLinkBadge> = {
  Cancelled: {
    bg: "var(--muted-bg)",
    color: "var(--muted)",
    label: "Cancelled",
  },
  Consumed: {
    bg: "var(--accent-muted)",
    color: "var(--accent)",
    label: "Funded",
  },
  Draft: {
    bg: "var(--muted-bg)",
    color: "var(--muted)",
    label: "Draft",
  },
  Expired: {
    bg: "var(--muted-bg)",
    color: "var(--muted)",
    label: "Expired",
  },
  Open: {
    bg: "var(--success-muted)",
    color: "var(--success)",
    label: "Open",
  },
};

export default function MyLinksPage() {
  const session = useWalletSessionContext();
  const isAuthenticated =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated";

  const [filter, setFilter] = useState<MyLinksFilter>("all");
  const [query, setQuery] = useState("");
  const [links, setLinks] = useState<MyLink[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLinkAction = (
    <Link href="/create" style={{ textDecoration: "none" }}>
      <Btn size="md" variant="primary">
        <Icon name="utility-plus" size={14} />
        New link
      </Btn>
    </Link>
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setLinks(null);
      setPage(0);
      setHasNextPage(false);
      return;
    }

    setLoading(true);
    setError(null);
    setLinks(null);
    fetchMyLinks({
      filter,
      limit: PAGE_SIZE + 1,
      offset: page * PAGE_SIZE,
    })
      .then((loadedLinks) => {
        setHasNextPage(loadedLinks.length > PAGE_SIZE);
        setLinks(loadedLinks.slice(0, PAGE_SIZE));
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load links."))
      .finally(() => setLoading(false));
  }, [filter, isAuthenticated, page]);

  function renderListContent() {
    if (links === null) {
      return null;
    }

    if (filter === "all" && links.length === 0 && !query) {
      return (
        <EmptyState
          action={createLinkAction}
          description="Create a consultation link to get started."
          icon={<Icon name="utility-plus" size={28} />}
          title="No links yet"
        />
      );
    }

    if (links.length === 0) {
      return (
        <EmptyState
          action={query ? (
            <Btn size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Btn>
          ) : (
            <Btn size="sm" variant="ghost" onClick={() => { setFilter("all"); setPage(0); }}>Show all</Btn>
          )}
          description={query ? `No links match "${query}".` : "Try another filter."}
          icon={<Icon name="utility-search" size={28} />}
          title="No matching links"
        />
      );
    }

    const filtered = query.trim()
      ? links.filter((l) =>
          `${l.title} ${l.id}`.toLowerCase().includes(query.toLowerCase().trim()),
        )
      : links;

    if (filtered.length === 0) {
      return (
        <EmptyState
          action={<Btn size="sm" variant="ghost" onClick={() => setQuery("")}>Clear search</Btn>}
          description={`No links match "${query}".`}
          icon={<Icon name="utility-search" size={28} />}
          title="No matching links"
        />
      );
    }

    return filtered.map((link, index) => (
      <LinkRow
        isLast={index === filtered.length - 1}
        key={link.id}
        link={link}
      />
    ));
  }

  if (!isAuthenticated) {
    return (
      <AppShell maxWidth={960}>
        <WalletAuthStatePanel
          icon={<Icon name="utility-plus" size={32} />}
          messages={MY_LINKS_AUTH_MESSAGES}
          session={session}
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={960}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 style={h1Style}>My links</h1>
          <p style={subStyle}>Consultation links you've created. Each link can be funded once.</p>
        </div>
        {createLinkAction}
      </div>

      <div style={tabsRowStyle}>
        <SegmentedTabs
          onChange={(value) => {
            setFilter(value as MyLinksFilter);
            setPage(0);
          }}
          options={FILTERS}
          value={filter}
        />
        <div style={searchBoxStyle}>
          <Icon name="utility-search" size={14} />
          <input
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or link ID…"
            style={searchInputStyle}
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
          title="Could not load links"
          tone="danger"
        />
      )}

      {!loading && !error && links !== null && (
        <>
          <ActionPanel style={listPanelStyle}>
            {renderListContent()}
          </ActionPanel>

          {links.length > 0 && (
            <p style={footerCountStyle}>
              Page {page + 1} · {links.length} shown
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

function LinkRow({
  isLast,
  link,
}: {
  isLast: boolean;
  link: MyLink;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [origin, setOrigin] = useState("");
  const isOriginReady = origin !== "";
  const shareUrl = `${origin}${link.share_url}`;
  const badge = getMyLinkBadge(link);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

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
      <div style={rowInfoStyle}>
        <p style={rowTitleStyle}>{link.title}</p>
        <div style={rowMetaStyle}>
          <span style={monoMetaStyle}>{link.id.slice(0, 8).toUpperCase()}</span>
          <span>·</span>
          <span>{formatDate(link.scheduled_at, { timeZone: link.timezone })}</span>
        </div>
      </div>

      <p style={priceStyle}>{link.price_usdc} USDC</p>

      <StatusPill
        bg={badge.bg}
        color={badge.color}
        label={badge.label}
      />

      <div style={actionsStyle}>
        <CopyIconButton disabled={!isOriginReady} text={shareUrl} />

        {link.status === "Open" && (
          <a
            aria-label="Open checkout"
            aria-disabled={!isOriginReady}
            href={isOriginReady ? shareUrl : undefined}
            rel="noreferrer"
            style={iconBtnStyle}
            target="_blank"
            title="Open checkout"
          >
            <Icon name="utility-arrow-right" size={13} />
          </a>
        )}

        {link.deal_id && (
          <Link href={`/deal/${link.deal_id}`} style={iconBtnStyle} title="View deal" aria-label="View deal">
            <Icon name="utility-chevron-right" size={13} />
          </Link>
        )}
      </div>
    </div>
  );
}

function CopyIconButton({ disabled = false, text }: { disabled?: boolean; text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    if (disabled) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable
    }
  }

  return (
    <button
      aria-label="Copy link"
      disabled={disabled}
      onClick={handleCopy}
      style={{ ...iconBtnStyle, opacity: disabled ? 0.4 : 1 }}
      title="Copy link"
      type="button"
    >
      <Icon name={copied ? "status-released" : "utility-copy-address"} size={13} />
    </button>
  );
}

function getMyLinkBadge(link: MyLink): MyLinkBadge {
  if (link.deal_status) {
    return getDealDisplayConfig({
      resolution_type: link.deal_resolution_type,
      status: link.deal_status,
    });
  }

  return LINK_STATUS_CONFIG[link.status];
}

const pageHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 16,
  justifyContent: "space-between",
} as const;

const h1Style = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.01em",
  margin: "0 0 4px",
} as const;

const subStyle = {
  color: "var(--muted)",
  fontSize: 14,
  margin: 0,
} as const;

const tabsRowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  justifyContent: "space-between",
} as const;

const searchBoxStyle = {
  alignItems: "center",
  background: "var(--surface-2)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-3)",
  color: "var(--muted)",
  display: "inline-flex",
  gap: 8,
  height: 36,
  padding: "0 12px",
} as const;

const searchInputStyle = {
  background: "transparent",
  border: "none",
  color: "var(--ink)",
  font: "inherit",
  fontSize: 13,
  outline: "none",
  width: 200,
} as const;

const listPanelStyle = {
  overflow: "hidden",
} as const;

const rowStyle = {
  alignItems: "center",
  display: "flex",
  flexWrap: "wrap" as const,
  gap: 12,
  padding: "14px 20px",
  transition: "background 0.12s",
} as const;

const rowInfoStyle = {
  flex: "1 1 200px",
  minWidth: 0,
} as const;

const rowTitleStyle = {
  color: "var(--ink)",
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
  gap: 4,
  marginTop: 3,
} as const;

const monoMetaStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
} as const;

const priceStyle = {
  color: "var(--ink)",
  flexShrink: 0,
  fontFamily: "var(--font-mono)",
  fontSize: 13,
  fontWeight: 500,
  margin: 0,
} as const;

const actionsStyle = {
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  gap: 2,
} as const;

const iconBtnStyle: CSSProperties = {
  alignItems: "center",
  background: "transparent",
  border: "none",
  borderRadius: "var(--r-2)",
  color: "var(--muted)",
  cursor: "pointer",
  display: "inline-flex",
  height: 32,
  justifyContent: "center",
  padding: 6,
  textDecoration: "none",
  width: 32,
};

const footerCountStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "12px 0 0",
  textAlign: "center" as const,
} as const;
