"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { ActionPanel } from "@/components/shared/action-panel";
import { DetailRow } from "@/components/shared/detail-row";
import { StatusPill } from "@/components/shared/status-pill";

interface DealStatusCardProps {
  deal: DealReadModel;
  isAdmin?: boolean;
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

export function DealStatusCard({ deal, isAdmin = false, role }: DealStatusCardProps) {
  const sc = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });

  return (
    <ActionPanel style={cardStyle}>
      <div style={headerStyle}>
        <div>
          <p style={eyebrowStyle}>Deal status</p>
          <h1 style={titleStyle}>Consultation escrow</h1>
        </div>
        <div style={badgeGroupStyle}>
          <StatusPill bg={sc.bg} color={sc.color} label={sc.label} size="md" />
          <StatusPill label={getRoleLabel(role, isAdmin)} tone={getRoleTone(role, isAdmin)} />
        </div>
      </div>

      <DetailRow
        label="Amount"
        value={`${deal.price_usdc} USDC`}
      />
      <DetailRow
        label="Seller"
        value={<span style={monoValueStyle}>{formatPartyAddress(deal.seller_address, role === "seller")}</span>}
      />
      <DetailRow
        label="Buyer"
        value={<span style={monoValueStyle}>{formatPartyAddress(deal.buyer_address, role === "buyer")}</span>}
      />
      <DetailRow label="Scheduled" value={formatDate(deal.scheduled_at)} />
      {deal.completed_at && (
        <DetailRow label="Completed" value={formatDate(deal.completed_at)} />
      )}
      {deal.resolved_at && (
        <DetailRow label="Resolved" value={formatDate(deal.resolved_at)} />
      )}
      {deal.release_deadline_at && (
        <DetailRow
          label={role === "seller" ? "Auto-release available after" : "Release / dispute deadline"}
          value={formatDate(deal.release_deadline_at)}
        />
      )}
      {deal.tx_hash && (
        <DetailRow
          bordered={false}
          label="Funding tx"
          value={<span style={monoValueStyle}>{`${deal.tx_hash.slice(0, 10)}…${deal.tx_hash.slice(-6)}`}</span>}
        />
      )}
    </ActionPanel>
  );
}

function formatPartyAddress(address: string, isCurrentUser: boolean): string {
  return isCurrentUser ? `${truncateAddress(address)} (you)` : truncateAddress(address);
}

function getRoleLabel(role: DealStatusCardProps["role"], isAdmin: boolean): string {
  if (role === "buyer") return "You are the buyer";
  if (role === "seller") return "You are the seller";
  if (isAdmin) return "Viewing as Admin";
  return "Viewer";
}

function getRoleTone(
  role: DealStatusCardProps["role"],
  isAdmin: boolean,
): "accent" | "danger" | "muted" | "success" {
  if (role === "buyer") return "accent";
  if (role === "seller") return "success";
  if (isAdmin) return "danger";
  return "muted";
}

const cardStyle = {
  padding: 20,
} as const;

const headerStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 14,
  justifyContent: "space-between",
  marginBottom: 10,
} as const;

const badgeGroupStyle = {
  alignItems: "flex-end",
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
};

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  margin: "0 0 6px",
  textTransform: "uppercase" as const,
};

const titleStyle = {
  color: "var(--foreground)",
  fontSize: 20,
  lineHeight: 1.2,
  margin: 0,
};

const monoValueStyle = {
  fontFamily: "monospace",
  overflowWrap: "anywhere" as const,
};
