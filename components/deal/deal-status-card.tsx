"use client";

import type { DealReadModel, DealStatus } from "@/lib/api/deals";

interface DealStatusCardProps {
  deal: DealReadModel;
  role: "buyer" | "seller" | "viewer";
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZoneName: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function resolutionLabel(deal: DealReadModel): string | null {
  switch (deal.resolution_type) {
    case "admin_release":
      return "Released after dispute";
    case "admin_refund":
      return "Refunded after dispute";
    case "auto_release":
      return "Auto-released after deadline";
    case "buyer_confirmed":
      return "Released by buyer confirmation";
    default:
      return null;
  }
}

const statusConfig: Record<DealStatus, { bg: string; color: string; label: string }> = {
  ConfirmPending: {
    bg: "var(--warning-muted)",
    color: "var(--warning)",
    label: "Awaiting confirmation",
  },
  Disputed: {
    bg: "var(--danger-muted)",
    color: "var(--danger)",
    label: "Disputed",
  },
  Funded: {
    bg: "var(--accent-muted)",
    color: "var(--accent)",
    label: "Funded",
  },
  Refunded: {
    bg: "var(--muted-bg)",
    color: "var(--muted)",
    label: "Refunded",
  },
  Released: {
    bg: "var(--success-muted)",
    color: "var(--success)",
    label: "Released",
  },
};

export function DealStatusCard({ deal, role }: DealStatusCardProps) {
  const sc = statusConfig[deal.status];
  const resolution = resolutionLabel(deal);

  return (
    <div style={cardStyle}>
      {/* Status badge */}
      <div style={{ marginBottom: 16 }}>
        <span
          style={{
            background: sc.bg,
            borderRadius: 20,
            color: sc.color,
            display: "inline-block",
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: "0.05em",
            padding: "4px 12px",
            textTransform: "uppercase",
          }}
        >
          {sc.label}
        </span>
      </div>

      <div style={gridStyle}>
        <Detail label="Seller" value={formatPartyAddress(deal.seller_address, role === "seller")} mono />
        <Detail label="Buyer" value={formatPartyAddress(deal.buyer_address, role === "buyer")} mono />
        <Detail label="Amount" value={`$${deal.price_usdc} USDC`} />
        <Detail label="Scheduled" value={formatDate(deal.scheduled_at)} />
        {deal.completed_at && (
          <Detail label="Completed" value={formatDate(deal.completed_at)} />
        )}
        {resolution && (
          <Detail label="Resolution" value={resolution} />
        )}
        {deal.resolved_at && (
          <Detail label="Resolved" value={formatDate(deal.resolved_at)} />
        )}
        {role !== "seller" && deal.release_deadline_at && (
          <Detail label="Release deadline" value={formatDate(deal.release_deadline_at)} />
        )}
        {deal.tx_hash && (
          <Detail
            label="Funding tx"
            value={`${deal.tx_hash.slice(0, 10)}…${deal.tx_hash.slice(-6)}`}
            mono
          />
        )}
      </div>
    </div>
  );
}

function formatPartyAddress(address: string, isCurrentUser: boolean): string {
  return isCurrentUser ? `${truncateAddress(address)} (you)` : truncateAddress(address);
}

function Detail({
  label,
  mono,
  value,
}: {
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div>
      <p style={metaLabelStyle}>{label}</p>
      <p
        style={{
          color: "var(--foreground)",
          fontFamily: mono ? "monospace" : "inherit",
          fontSize: 14,
          fontWeight: 500,
          margin: 0,
          wordBreak: "break-all",
        }}
      >
        {value}
      </p>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  boxShadow: "var(--shadow-card)",
  padding: 20,
} as const;

const gridStyle = {
  display: "grid",
  gap: "14px 0",
} as const;

const metaLabelStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.07em",
  margin: "0 0 2px",
  textTransform: "uppercase" as const,
};
