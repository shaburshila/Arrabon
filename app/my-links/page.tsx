"use client";

// /my-links — Seller's view of their consultation links.
// Requires wallet connection + SIWE session.

import { useEffect, useState } from "react";
import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { fetchMyLinks, type MyLink } from "@/lib/api/links";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";
import { Btn } from "@/components/shared/btn";

const STATUS_LABELS: Record<MyLink["status"], string> = {
  Cancelled: "Cancelled",
  Consumed: "Funded",
  Draft: "Draft",
  Expired: "Expired",
  Open: "Open",
};

const STATUS_COLORS: Record<MyLink["status"], string> = {
  Cancelled: "var(--muted)",
  Consumed: "var(--accent)",
  Draft: "var(--muted)",
  Expired: "var(--muted)",
  Open: "var(--success)",
};

function formatDate(iso: string, tz: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZone: tz,
      year: "numeric",
    });
  } catch {
    return new Date(iso).toLocaleString();
  }
}

export default function MyLinksPage() {
  const session = useWalletSession();
  const isAuthenticated =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated";

  const [links, setLinks] = useState<MyLink[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLinks(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchMyLinks()
      .then(setLinks)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load links."))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        {/* Header */}
        <div style={headerStyle}>
          <Link href="/" style={{ color: "var(--accent)", fontSize: 12, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
            Base Consult Link
          </Link>
          <h1 style={h1Style}>My consultation links</h1>
          <p style={subtitleStyle}>All links you have created.</p>
        </div>

        <WalletSessionCard session={session} />

        {isAuthenticated && (
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Link href="/">
              <Btn variant="primary">+ New link</Btn>
            </Link>
          </div>
        )}

        {isAuthenticated && loading && (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Loading…</p>
        )}

        {isAuthenticated && error && (
          <div style={errorStyle}>{error}</div>
        )}

        {isAuthenticated && links && links.length === 0 && (
          <div style={emptyStyle}>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              No links yet.{" "}
              <Link href="/" style={{ color: "var(--accent)" }}>Create your first one.</Link>
            </p>
          </div>
        )}

        {isAuthenticated && links && links.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {links.map((link) => (
              <LinkCard key={link.id} link={link} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function LinkCard({ link }: { link: MyLink }) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const shareUrl = `${origin}${link.share_url}`;

  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 15, fontWeight: 600, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {link.title}
          </p>
          <p style={{ color: "var(--muted)", fontSize: 12, margin: "2px 0 0" }}>
            {formatDate(link.scheduled_at, link.timezone)} · {link.duration_minutes} min · {link.price_usdc} USDC
          </p>
        </div>
        <span style={statusBadge(link.status)}>{STATUS_LABELS[link.status]}</span>
      </div>

      {link.description && (
        <p style={{ color: "var(--muted)", fontSize: 13, margin: "0 0 10px", lineHeight: 1.5 }}>
          {link.description}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
        {link.status === "Open" && (
          <>
            <a href={shareUrl} style={linkStyle} target="_blank" rel="noreferrer">
              Open link ↗
            </a>
            <button
              onClick={() => navigator.clipboard.writeText(shareUrl)}
              style={textBtnStyle}
              type="button"
            >
              Copy link
            </button>
          </>
        )}
        {link.status === "Consumed" && link.share_url && (
          <Link href={link.share_url.replace("/link/", "/deal/") + ""} style={linkStyle}>
            View deal
          </Link>
        )}
      </div>
    </div>
  );
}

function statusBadge(status: MyLink["status"]) {
  return {
    background: STATUS_COLORS[status] + "1a",
    border: `1px solid ${STATUS_COLORS[status]}33`,
    borderRadius: 99,
    color: STATUS_COLORS[status],
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: "0.06em",
    padding: "3px 10px",
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  };
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
  maxWidth: 560,
  width: "100%",
};

const headerStyle = { paddingBottom: 4 } as const;

const h1Style = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: "8px 0 8px",
} as const;

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
} as const;

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-card)",
  padding: 16,
} as const;

const emptyStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  padding: 20,
} as const;

const errorStyle = {
  background: "var(--danger-muted)",
  border: "1px solid var(--danger)",
  borderRadius: "var(--radius-sm)",
  color: "var(--danger)",
  fontSize: 13,
  padding: "10px 14px",
} as const;

const linkStyle = {
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 500,
} as const;

const textBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--muted)",
  cursor: "pointer",
  fontSize: 13,
  padding: 0,
  textDecoration: "underline",
} as const;
