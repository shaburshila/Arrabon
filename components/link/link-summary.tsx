"use client";

import type { PublicLink } from "@/lib/api/links";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { Icon } from "@/components/icons";
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

function getStatusPill(status: string): {
  label: string;
  tone: "accent" | "gold" | "muted" | "green";
} {
  if (status === "Open") return { label: "Open", tone: "green" };
  if (status === "Consumed") return { label: "Funded", tone: "gold" };
  return { label: status, tone: "muted" };
}

export function LinkSummary({ link }: LinkSummaryProps) {
  const status = getStatusPill(link.status);

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} tone={status.tone} />
          <h1 style={titleStyle}>{link.title}</h1>
          <p style={sellerStyle}>Seller {truncateAddress(link.seller_address)}</p>
        </div>
        <div className="deal-hero__amount">
          <div className="deal-hero__amount-num">{link.price_usdc}</div>
          <div className="deal-hero__amount-token">USDC</div>
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
          label="Seller"
          mono
          value={truncateAddress(link.seller_address)}
        />
        <DetailRow
          bordered={false}
          label="Link ID"
          mono
          value={link.id.slice(0, 8).toUpperCase()}
        />
      </div>

      <div style={trustStyle}>
        <Icon name="utility-secure-subtle" size={14} />
        Funds are held in escrow on Base until the consultation is confirmed or disputed.
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-4)",
  display: "flex",
  flexDirection: "column" as const,
  gap: 24,
  overflow: "hidden",
  padding: "28px 32px",
} as const;

const headerStyle = {
  alignItems: "flex-start",
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
} as const;

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 28,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.15,
  margin: "10px 0 6px",
  overflowWrap: "anywhere" as const,
  textWrap: "balance" as const,
} as const;

const sellerStyle = {
  color: "var(--muted)",
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  letterSpacing: "-0.005em",
  margin: 0,
} as const;

const descriptionStyle = {
  color: "var(--ink-soft)",
  fontSize: 14.5,
  lineHeight: 1.55,
  margin: 0,
} as const;

const detailsStyle = {
  display: "flex",
  flexDirection: "column" as const,
} as const;

const trustStyle = {
  alignItems: "center",
  background: "var(--gold-soft)",
  border: "1px solid color-mix(in srgb, var(--gold) 18%, transparent)",
  borderRadius: "var(--r-2)",
  color: "var(--gold-deep)",
  display: "flex",
  fontSize: 13,
  gap: 10,
  lineHeight: 1.5,
  padding: "12px 16px",
} as const;
