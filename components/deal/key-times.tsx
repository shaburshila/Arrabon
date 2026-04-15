"use client";

import type { DealReadModel } from "@/lib/api/deals";

interface KeyTimesProps {
  deal: DealReadModel;
  isSeller: boolean;
}

function formatAbsoluteDate(value: Date): string {
  return value.toLocaleString("en-US", {
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    timeZoneName: "short",
  });
}

function formatRelativeLabel(msUntil: number, mode: "left" | "until"): string {
  const minutes = Math.max(1, Math.round(msUntil / 60_000));

  if (minutes > 48 * 60) {
    const days = Math.round(minutes / (24 * 60));
    return mode === "left" ? `${days} days left` : `in ${days} days`;
  }

  if (minutes > 2 * 60) {
    const hours = Math.round(minutes / 60);
    return mode === "left" ? `${hours} hours left` : `in ${hours} hours`;
  }

  return mode === "left" ? `${minutes} minutes left` : `in ${minutes} minutes`;
}

function formatRelativeAndAbsolute(
  iso: string | null,
  mode: "left" | "past-absolute" | "until",
): string | null {
  if (!iso) return null;

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return iso;
  }

  const absolute = formatAbsoluteDate(date);

  if (mode === "past-absolute") {
    return absolute;
  }

  const msUntil = date.getTime() - Date.now();

  if (msUntil <= 0) {
    return absolute;
  }

  return `${formatRelativeLabel(msUntil, mode)} (${absolute})`;
}

export function KeyTimes({ deal, isSeller }: KeyTimesProps) {
  const items: { label: string; value: string | null }[] = [
    {
      label: "Consultation scheduled",
      value: formatRelativeAndAbsolute(
        deal.scheduled_at,
        new Date(deal.scheduled_at).getTime() > Date.now() ? "until" : "past-absolute",
      ),
    },
    {
      label: "Available to complete from",
      value: deal.status === "Funded"
        ? formatRelativeAndAbsolute(deal.mark_completed_after, "until")
        : null,
    },
    {
      label: "Completed at",
      value: formatRelativeAndAbsolute(deal.completed_at, "past-absolute"),
    },
    {
      label: "Release / dispute deadline",
      value: !isSeller
        ? formatRelativeAndAbsolute(deal.release_deadline_at, "left")
        : null,
    },
  ].filter((item) => item.value !== null);

  if (items.length === 0) return null;

  return (
    <div
      style={{
        background: "var(--surface-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        padding: 20,
      }}
    >
      <p
        style={{
          color: "var(--muted)",
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: "0.08em",
          margin: "0 0 14px",
          textTransform: "uppercase",
        }}
      >
        Timeline
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item) => (
          <div
            key={item.label}
            style={{ alignItems: "center", display: "flex", gap: 8 }}
          >
            <span
              style={{
                background: "var(--border)",
                borderRadius: "50%",
                display: "inline-block",
                flexShrink: 0,
                height: 8,
                width: 8,
              }}
            />
            <span style={{ color: "var(--muted)", fontSize: 13, flexShrink: 0 }}>
              {item.label}
            </span>
            <span
              style={{
                color: "var(--foreground)",
                fontSize: 13,
                fontWeight: 500,
                marginLeft: "auto",
                textAlign: "right",
              }}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
