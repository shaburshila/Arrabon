"use client";

// Displays public consultation link metadata.

import type { PublicLink } from "@/lib/api/links";

interface LinkSummaryProps {
  link: PublicLink;
}

function formatDate(iso: string, timezone?: string) {
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZone: timezone || "UTC",
      timeZoneName: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function LinkSummary({ link }: LinkSummaryProps) {
  return (
    <div style={cardStyle}>
      {/* Status badge */}
      <div style={{ marginBottom: 16 }}>
        <StatusBadge status={link.status} />
      </div>

      {/* Title + description */}
      <h2 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>
        {link.title}
      </h2>
      {link.description && (
        <p style={{ color: "var(--muted)", fontSize: 15, margin: "0 0 20px", lineHeight: 1.5 }}>
          {link.description}
        </p>
      )}

      {/* Key details grid */}
      <div style={gridStyle}>
        <Detail label="Price" value={`$${link.price_usdc} USDC`} accent />
        <Detail
          label="Scheduled"
          value={formatDate(link.scheduled_at, link.timezone)}
        />
        <Detail label="Duration" value={formatDuration(link.duration_minutes)} />
        <Detail
          label="Expires"
          value={formatDate(link.expires_at, link.timezone)}
        />
        <Detail
          label="Seller"
          value={truncateAddress(link.seller_address)}
          mono
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    Consumed: { bg: "var(--accent-muted)", color: "var(--accent)" },
    Open: { bg: "var(--success-muted)", color: "var(--success)" },
  };
  const style = colors[status] ?? { bg: "var(--muted-bg)", color: "var(--muted)" };

  return (
    <span
      style={{
        background: style.bg,
        borderRadius: 20,
        color: style.color,
        display: "inline-block",
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: "0.04em",
        padding: "3px 10px",
        textTransform: "uppercase",
      }}
    >
      {status}
    </span>
  );
}

function Detail({
  accent,
  label,
  mono,
  value,
}: {
  accent?: boolean;
  label: string;
  mono?: boolean;
  value: string;
}) {
  return (
    <div>
      <p
        style={{
          color: "var(--muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.07em",
          margin: "0 0 2px",
          textTransform: "uppercase",
        }}
      >
        {label}
      </p>
      <p
        style={{
          color: accent ? "var(--accent)" : "var(--foreground)",
          fontFamily: mono ? "monospace" : "inherit",
          fontSize: accent ? 18 : 14,
          fontWeight: accent ? 700 : 500,
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
