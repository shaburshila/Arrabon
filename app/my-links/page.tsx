"use client";

// /my-links — Seller's view of their consultation links.
// Requires wallet connection + SIWE session.

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import {
  Check,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Plus,
} from "lucide-react";

import { useWalletSessionContext } from "@/contexts/wallet-session-context";
import { fetchMyLinks, type MyLink, type MyLinksFilter } from "@/lib/api/links";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { formatDate } from "@/lib/ui/date";
import { AppShell } from "@/components/app/app-shell";
import { ActionPanel } from "@/components/shared/action-panel";
import { Btn } from "@/components/shared/btn";
import { EmptyState } from "@/components/shared/empty-state";
import { ListPagination } from "@/components/shared/list-pagination";
import { Notice } from "@/components/shared/notice";
import { SegmentedTabs } from "@/components/shared/segmented-tabs";
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
  const [links, setLinks] = useState<MyLink[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createLinkAction = (
    <Link href="/create" style={{ textDecoration: "none" }}>
      <Btn size="sm">
        <Plus size={14} />
        Create link
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

    if (filter === "all" && links.length === 0) {
      return (
        <EmptyState
          action={createLinkAction}
          description="Create a consultation link to get started."
          icon={<Link2 size={36} />}
          title="No links"
        />
      );
    }

    if (links.length === 0) {
      return (
        <EmptyState
          description="Try another filter."
          icon={<Link2 size={36} />}
          title="No matching links"
        />
      );
    }

    return links.map((link, index) => (
      <LinkRow
        isLast={index === links.length - 1}
        key={link.id}
        link={link}
      />
    ));
  }

  if (!isAuthenticated) {
    return (
      <AppShell maxWidth={672}>
        <WalletAuthStatePanel
          icon={<Link2 size={40} />}
          messages={MY_LINKS_AUTH_MESSAGES}
          session={session}
        />
      </AppShell>
    );
  }

  return (
    <AppShell maxWidth={672}>
      <div style={pageHeaderStyle}>
        <h1 style={h1Style}>My links</h1>
        {createLinkAction}
      </div>

      <SegmentedTabs
        onChange={(value) => {
          setFilter(value as MyLinksFilter);
          setPage(0);
        }}
        options={FILTERS}
        value={filter}
      />

      {loading && (
        <ActionPanel style={listPanelStyle}>
          <LinkSkeletonRows />
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

function LinkSkeletonRows() {
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
            <div style={{ ...skeletonLineStyle, marginTop: 8, width: "38%" }} />
          </div>
          <div style={{ ...skeletonLineStyle, width: 72 }} />
          <div style={{ ...skeletonLineStyle, width: 68 }} />
          <div style={{ ...skeletonLineStyle, width: 72 }} />
        </div>
      ))}
    </>
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
      <div style={rowIconStyle}>
        <Link2 size={15} />
      </div>

      <div style={rowInfoStyle}>
        <p style={rowTitleStyle}>{link.title}</p>
        <div style={rowMetaStyle}>
          <Clock size={11} />
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
        <CopyIconButton text={shareUrl} />

        {link.status === "Open" && (
          <IconAnchor
            href={shareUrl}
            label="Open checkout"
          >
            <ExternalLink size={13} />
          </IconAnchor>
        )}

        {link.deal_id && (
          <IconNextLink
            href={`/deal/${link.deal_id}`}
            label="View deal"
          >
            <Eye size={13} />
          </IconNextLink>
        )}
      </div>
    </div>
  );
}

function CopyIconButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // The browser can deny clipboard access. The action is non-critical.
    }
  }

  return (
    <IconButton
      label="Copy link"
      onClick={handleCopy}
    >
      {copied ? <Check size={13} style={{ color: "var(--success)" }} /> : <Copy size={13} />}
    </IconButton>
  );
}

function IconButton({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      aria-label={label}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={iconActionStyle(isHovered)}
      title={label}
      type="button"
    >
      {children}
    </button>
  );
}

function IconAnchor({
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
    <a
      aria-label={label}
      href={href}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      rel="noreferrer"
      style={iconActionStyle(isHovered)}
      target="_blank"
      title={label}
    >
      {children}
    </a>
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

function getMyLinkBadge(link: MyLink): MyLinkBadge {
  if (link.deal_status) {
    return getDealDisplayConfig({
      resolution_type: link.deal_resolution_type,
      status: link.deal_status,
    });
  }

  return LINK_STATUS_CONFIG[link.status];
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
  fontSize: 12,
  gap: 6,
  marginTop: 4,
} as const;

const priceStyle = {
  color: "var(--foreground)",
  flexShrink: 0,
  fontSize: 14,
  fontWeight: 600,
  margin: 0,
} as const;

const actionsStyle = {
  alignItems: "center",
  display: "flex",
  flexShrink: 0,
  gap: 2,
} as const;

const footerCountStyle = {
  color: "var(--muted)",
  fontSize: 12,
  margin: "12px 0 0",
  textAlign: "center" as const,
} as const;
