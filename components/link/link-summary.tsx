"use client";

import type { PublicLink } from "@/lib/api/links";
import { truncateAddress } from "@/lib/ui/address";
import { formatDate } from "@/lib/ui/date";
import { formatUsdcPrice } from "@/lib/ui/format";
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
      <div style={headerSectionStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <StatusPill label={status.label} tone={status.tone} />
          <h1 style={titleStyle}>{link.title}</h1>
          <p style={sellerStyle}>
            Seller <span style={sellerMonoStyle}>{truncateAddress(link.seller_address)}</span>
          </p>
        </div>
        <div className="deal-hero__amount" style={{ flexShrink: 0 }}>
          <div className="deal-hero__amount-num" style={{ fontSize: 36 }}>
            {formatUsdcPrice(link.price_usdc)}
          </div>
          <div className="deal-hero__amount-token">USDC</div>
        </div>
      </div>

      {link.description && (
        <div style={descriptionSectionStyle}>
          <p style={descriptionStyle}>{link.description}</p>
        </div>
      )}

      <div style={detailsSectionStyle}>
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

      <div style={trustSectionStyle}>
        <Icon name="utility-secure-subtle" size={18} />
        <p style={trustTextStyle}>
          Funds held in escrow on Base. Meeting URL revealed only after funding.
        </p>
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
  overflow: "hidden",
} as const;

const headerSectionStyle = {
  alignItems: "flex-start",
  borderBottom: "1px solid var(--border)",
  display: "flex",
  gap: 20,
  justifyContent: "space-between",
  padding: "28px 32px",
} as const;

const titleStyle = {
  color: "var(--ink)",
  fontFamily: "var(--font-serif)",
  fontSize: 32,
  fontWeight: 500,
  letterSpacing: "-0.005em",
  lineHeight: 1.15,
  margin: "10px 0 6px",
  overflowWrap: "anywhere" as const,
  textWrap: "balance" as const,
} as const;

const sellerStyle = {
  color: "var(--muted)",
  fontSize: 13,
  margin: 0,
} as const;

const sellerMonoStyle = {
  fontFamily: "var(--font-mono)",
  fontSize: 12.5,
  letterSpacing: "-0.005em",
};

const descriptionSectionStyle = {
  borderBottom: "1px solid var(--border)",
  padding: "20px 32px",
} as const;

const descriptionStyle = {
  color: "var(--muted)",
  fontSize: 14.5,
  lineHeight: 1.55,
  margin: 0,
} as const;

const detailsSectionStyle = {
  padding: "8px 32px 20px",
} as const;

const trustSectionStyle = {
  alignItems: "center",
  background: "var(--gold-soft)",
  borderTop: "1px solid var(--border)",
  display: "flex",
  gap: 12,
  padding: "16px 32px",
} as const;

const trustTextStyle = {
  color: "var(--ink-soft)",
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  margin: 0,
} as const;
