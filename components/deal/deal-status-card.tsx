"use client";

import type { DealReadModel } from "@/lib/api/deals";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { getDealDisplayConfig } from "@/lib/ui/deal-status";
import { Icon } from "@/components/icons";
import { ActionPanel } from "@/components/shared/action-panel";
import { DetailRow } from "@/components/shared/detail-row";
import { StatusPill } from "@/components/shared/status-pill";

const STATUS_TITLES: Record<string, string> = {
  ConfirmPending: "Confirm payment release",
  Disputed: "Under dispute review",
  Funded: "Escrow funded",
  Refunded: "Funds refunded",
  Released: "Payment released",
};

interface DealStatusCardProps {
  deal: DealReadModel;
  isAdmin?: boolean;
  role: "buyer" | "seller" | "viewer";
}

export function DealStatusCard({ deal, isAdmin = false, role }: DealStatusCardProps) {
  const sc = getDealDisplayConfig({
    resolution_type: deal.resolution_type,
    status: deal.status,
  });
  const title = STATUS_TITLES[deal.status] ?? "Consultation escrow";

  return (
    <>
      <div className="deal-hero">
        <span style={statusIconStyle(sc.bg, sc.color)}>
          <Icon name={sc.icon} size={28} />
        </span>
        <div style={heroBodyStyle}>
          <p style={eyebrowStyle}>Deal · {deal.id.slice(0, 8).toUpperCase()}</p>
          <h1 style={heroTitleStyle}>{title}</h1>
          <StatusPill label={getRoleLabel(role, isAdmin)} tone={getRoleTone(role, isAdmin)} />
        </div>
        <div className="deal-hero__amount">
          <div className="deal-hero__amount-num">{deal.price_usdc}</div>
          <div className="deal-hero__amount-token">USDC · {sc.label}</div>
        </div>
      </div>

      <ActionPanel style={{ padding: "0 20px" }}>
        <DetailRow
          label="Seller"
          value={<span style={monoValueStyle}>{formatPartyAddress(deal.seller_address, role === "seller")}</span>}
        />
        <DetailRow
          label="Buyer"
          value={<span style={monoValueStyle}>{formatPartyAddress(deal.buyer_address, role === "buyer")}</span>}
        />
        <DetailRow
          label="Scheduled"
          value={formatDate(deal.scheduled_at, { fallback: "—", showTimeZoneName: true })}
        />
        {deal.completed_at && (
          <DetailRow
            label="Completed"
            value={formatDate(deal.completed_at, { fallback: "—", showTimeZoneName: true })}
          />
        )}
        {deal.resolved_at && (
          <DetailRow
            label="Resolved"
            value={formatDate(deal.resolved_at, { fallback: "—", showTimeZoneName: true })}
          />
        )}
        {deal.release_deadline_at && (
          <DetailRow
            label={role === "seller" ? "Auto-release available after" : "Release / dispute deadline"}
            value={formatDate(deal.release_deadline_at, { fallback: "—", showTimeZoneName: true })}
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
    </>
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

function statusIconStyle(bg: string, color: string) {
  return {
    alignItems: "center",
    background: bg,
    borderRadius: "50%",
    color,
    display: "inline-grid",
    flexShrink: 0,
    height: 56,
    placeItems: "center",
    width: 56,
  } as const;
}

const heroBodyStyle = {
  display: "flex",
  flexDirection: "column" as const,
  gap: 8,
  minWidth: 0,
};

const eyebrowStyle = {
  color: "var(--muted)",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.1em",
  margin: 0,
  textTransform: "uppercase" as const,
};

const heroTitleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.01em",
  lineHeight: 1.1,
  margin: 0,
};

const monoValueStyle = {
  fontFamily: "var(--font-mono, monospace)",
  overflowWrap: "anywhere" as const,
};
