"use client";

// /my-links — Seller's view of their consultation links.
// Requires wallet connection + SIWE session.

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchMyLinks, type MyLink, type MyLinksFilter } from "@/lib/api/links";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { formatDate } from "@/lib/ui/date";
import { formatUsdcPrice } from "@/lib/ui/format";
import { dealTrailingLabel } from "@/lib/ui/deal-trailing-label";
import { Icon, type IconName } from "@/components/icons";
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
    bg: "var(--gold-soft)",
    color: "var(--gold-deep)",
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

  const FILTERS = useMemo(
    () => [
      { value: "all" as const, label: `All${links !== null ? ` · ${links.length}` : ""}` },
      { value: "available" as const, label: "Available" },
      { value: "upcoming" as const, label: "Upcoming" },
      { value: "awaiting_buyer" as const, label: "Awaiting buyer" },
      { value: "disputed" as const, label: "Disputed" },
      { value: "closed" as const, label: "Closed" },
      { value: "inactive" as const, label: "Inactive" },
    ],
    [links],
  );

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

    return filtered.map((link) => (
      <LinkRow
        key={link.id}
        link={link}
      />
    ));
  }

  if (!isAuthenticated) {
    return (
      <AppShell maxWidth={1180}>
        <WalletAuthStatePanel
          icon={<Icon name="utility-plus" size={32} />}
          messages={MY_LINKS_AUTH_MESSAGES}
          session={session}
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={1180}>
      <div style={pageHeaderStyle}>
        <div>
          <h1 className="h1">My links</h1>
          <p className="lede" style={{ marginTop: 8 }}>Consultation links you've created. Each link can be funded once.</p>
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
        <div className="search-input">
          <span className="search-input__icon">
            <Icon name="utility-search" size={14} />
          </span>
          <input
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or link ID…"
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

function LinkRow({ link }: { link: MyLink; isLast?: boolean }) {
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const badge = getMyLinkBadge(link);
  const trailing = link.deal_status
    ? dealTrailingLabel(link.deal_status)
    : link.status === "Open"
      ? "Awaiting buyer"
      : link.status === "Expired"
        ? "Expired"
        : link.status === "Cancelled"
          ? "Cancelled"
          : link.status === "Consumed"
            ? "Funded"
            : "";

  const href = link.deal_id
    ? `/deal/${link.deal_id}`
    : origin && link.share_url
      ? link.share_url
      : "#";

  return (
    <Link href={href} className="list-row">
      <div className="list-row__title">
        <span className="list-row__title-name">{link.title}</span>
        <span className="list-row__title-sub">
          {formatDate(link.scheduled_at, { timeZone: link.timezone })}
        </span>
      </div>
      <span className="list-row__price">
        {formatUsdcPrice(link.price_usdc)}
        <span className="list-row__price-token">USDC</span>
      </span>
      <StatusPill bg={badge.bg} color={badge.color} icon={badge.icon} label={badge.label} />
      <span className="list-row__trailing">{trailing}</span>
      <span className="list-row__chevron">
        <Icon name="utility-chevron-right" size={16} />
      </span>
    </Link>
  );
}

function getMyLinkBadge(link: MyLink): MyLinkBadge & { icon?: IconName } {
  if (link.deal_status) {
    return getDealDisplayConfig({
      resolution_type: link.deal_resolution_type,
      status: link.deal_status,
    });
  }

  const linkIconByStatus: Record<MyLink["status"], IconName> = {
    Open: "utility-circle",
    Consumed: "utility-lock",
    Cancelled: "utility-close",
    Draft: "utility-hourglass",
    Expired: "status-expired",
  };
  return {
    ...LINK_STATUS_CONFIG[link.status],
    icon: linkIconByStatus[link.status],
  };
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
