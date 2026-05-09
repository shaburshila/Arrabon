"use client";

// Displays public consultation link metadata.

import type { PublicLink } from "@/lib/api/links";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { ActionPanel } from "@/components/shared/action-panel";
import { DetailRow } from "@/components/shared/detail-row";
import { StatusPill } from "@/components/shared/status-pill";

interface LinkSummaryProps {
  link: PublicLink;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function LinkSummary({ link }: LinkSummaryProps) {
  const status = getStatusPill(link.status);

  return (
    <ActionPanel style={{ overflow: "hidden" }}>
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} tone={status.tone} />
          <h1 style={titleStyle}>{link.title}</h1>
          <p style={sellerStyle}>Seller {truncateAddress(link.seller_address)}</p>
        </div>
        <div style={pricePillStyle}>
          <span style={priceValueStyle}>{link.price_usdc}</span>
          <span style={priceTokenStyle}>USDC</span>
        </div>
      </div>

      {link.description && (
        <p style={descriptionStyle}>{link.description}</p>
      )}

      <div style={detailsStyle}>
        <DetailRow
          label="Scheduled"
          value={formatDate(link.scheduled_at, {
            showTimeZoneName: true,
            timeZone: link.timezone,
          })}
        />
        <DetailRow
          label="Duration"
          value={`${formatDuration(link.duration_minutes)} · ${link.timezone}`}
        />
        <DetailRow
          label="Expires"
          value={formatDate(link.expires_at, {
            showTimeZoneName: true,
            timeZone: link.timezone,
          })}
        />
        <DetailRow
          bordered={false}
          label="Seller"
          value={truncateAddress(link.seller_address)}
        />
      </div>

      <div style={paymentDeadlineStyle}>
        Payment must be made before{" "}
        {formatDate(link.expires_at, {
          showTimeZoneName: true,
          timeZone: link.timezone,
        })}
        .
      </div>

      <div style={escrowLineStyle}>
        Funds are held in escrow on Base until the consultation is confirmed or disputed.
      </div>
    </ActionPanel>
  );
}

function getStatusPill(status: string): {
  label: string;
  tone: "accent" | "muted" | "success";
} {
  if (status === "Open") {
    return { label: "Open", tone: "success" };
  }

  if (status === "Consumed") {
    return { label: "Funded", tone: "accent" };
  }

  return { label: status, tone: "muted" };
}

const headerStyle = {
  alignItems: "flex-start",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  gap: 14,
  justifyContent: "space-between",
  padding: 20,
} as const;

const titleStyle = {
  color: "var(--foreground)",
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.15,
  margin: "12px 0 6px",
  overflowWrap: "anywhere" as const,
};

const sellerStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: 0,
};

const pricePillStyle = {
  background: "var(--accent-muted)",
  borderRadius: "var(--radius)",
  color: "var(--accent)",
  flexShrink: 0,
  padding: "10px 12px",
  textAlign: "right" as const,
};

const priceValueStyle = {
  display: "block",
  fontSize: 17,
  fontWeight: 850,
  lineHeight: 1.1,
};

const priceTokenStyle = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  lineHeight: 1.2,
  marginTop: 2,
  opacity: 0.75,
};

const descriptionStyle = {
  borderBottom: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 14,
  lineHeight: 1.5,
  margin: 0,
  padding: "0 20px 18px",
};

const detailsStyle = {
  padding: "8px 20px",
};

const paymentDeadlineStyle = {
  background: "var(--accent-muted)",
  borderTop: "1px solid var(--border)",
  color: "var(--foreground)",
  fontSize: 13,
  fontWeight: 700,
  lineHeight: 1.45,
  padding: "12px 20px",
};

const escrowLineStyle = {
  background: "var(--panel-muted)",
  borderTop: "1px solid var(--border)",
  color: "var(--muted)",
  fontSize: 13,
  lineHeight: 1.45,
  padding: "14px 20px",
};
