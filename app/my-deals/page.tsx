"use client";

// /my-deals — Buyer recovery surface for paid consultations.
// Requires wallet connection + SIWE session.

import { useEffect, useState } from "react";
import Link from "next/link";

import { useWalletSession } from "@/hooks/use-wallet-session";
import { fetchMyDeals, type MyDeal } from "@/lib/api/deals";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { WalletSessionCard } from "@/components/shared/wallet-session-card";

function shortAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

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

export default function MyDealsPage() {
  const session = useWalletSession();
  const isAuthenticated =
    session.isConnected &&
    session.isCorrectChain &&
    session.siweStatus === "authenticated";

  const [deals, setDeals] = useState<MyDeal[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setDeals(null);
      return;
    }

    setLoading(true);
    setError(null);
    fetchMyDeals()
      .then(setDeals)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load deals."))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  return (
    <main style={mainStyle}>
      <div style={pageStyle}>
        <div style={headerStyle}>
          <Link href="/" style={brandStyle}>
            Base Consult Link
          </Link>
          <h1 style={h1Style}>My deals</h1>
          <p style={subtitleStyle}>Consultations you have paid for.</p>
        </div>

        <WalletSessionCard session={session} />

        {isAuthenticated && loading && (
          <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>Loading...</p>
        )}

        {isAuthenticated && error && (
          <div style={errorStyle}>{error}</div>
        )}

        {isAuthenticated && deals && deals.length === 0 && (
          <div style={emptyStyle}>
            <p style={{ color: "var(--muted)", fontSize: 14, margin: 0 }}>
              No paid consultations yet.
            </p>
          </div>
        )}

        {isAuthenticated && deals && deals.length > 0 && (
          <div style={listStyle}>
            {deals.map((deal) => (
              <DealCard deal={deal} key={deal.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function DealCard({ deal }: { deal: MyDeal }) {
  const badge = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });

  return (
    <div style={cardStyle}>
      <div style={cardHeaderStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={dealTitleStyle}>{deal.title}</h2>
          <p style={metaStyle}>
            {formatDate(deal.scheduled_at, deal.timezone)} · {deal.duration_minutes} min · {deal.price_usdc} USDC
          </p>
        </div>
        <span style={statusBadgeStyle(badge)}>{badge.label}</span>
      </div>

      {deal.description && (
        <p style={descriptionStyle}>{deal.description}</p>
      )}

      <div style={detailsStyle}>
        <span>Seller: {shortAddress(deal.seller_address)}</span>
        <span>Deal #{deal.onchain_deal_id}</span>
      </div>

      <Link href={`/deal/${deal.id}`} style={linkStyle}>
        View deal
      </Link>
    </div>
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
  maxWidth: 560,
  width: "100%",
};

const headerStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const brandStyle = {
  color: "var(--accent)",
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textDecoration: "none",
  textTransform: "uppercase" as const,
};

const h1Style = {
  fontSize: 24,
  fontWeight: 800,
  letterSpacing: "-0.02em",
  margin: 0,
};

const subtitleStyle = {
  color: "var(--muted)",
  fontSize: 15,
  lineHeight: 1.5,
  margin: 0,
};

const listStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
};

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  boxShadow: "var(--shadow-card)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 12,
  padding: 16,
};

const cardHeaderStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 10,
};

const dealTitleStyle = {
  fontSize: 16,
  lineHeight: 1.3,
  margin: "0 0 4px",
  overflowWrap: "anywhere" as const,
};

const metaStyle = {
  color: "var(--muted)",
  fontSize: 12,
  lineHeight: 1.4,
  margin: 0,
};

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.5,
  margin: 0,
  overflowWrap: "anywhere" as const,
};

const detailsStyle = {
  color: "var(--muted)",
  display: "flex",
  flexWrap: "wrap" as const,
  fontSize: 12,
  gap: 10,
};

function statusBadgeStyle(badge: { bg: string; color: string }) {
  return {
    background: badge.bg,
    border: "1px solid transparent",
    borderRadius: 8,
    color: badge.color,
    flexShrink: 0,
    fontSize: 11,
    fontWeight: 700,
    padding: "4px 8px",
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
  };
}

const linkStyle = {
  alignSelf: "flex-start",
  color: "var(--accent)",
  fontSize: 13,
  fontWeight: 700,
  textDecoration: "none",
};

const emptyStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  padding: 20,
};

const errorStyle = {
  background: "var(--danger-muted)",
  border: "1px solid var(--danger)",
  borderRadius: 8,
  color: "var(--danger)",
  fontSize: 13,
  padding: "10px 14px",
} as const;
