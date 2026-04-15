"use client";

import type { DealReadModel } from "@/lib/api/deals";

interface KeyTimesProps {
  deal: DealReadModel;
  isSeller: boolean;
}

function formatDate(iso: string | null) {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("en-US", {
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      timeZoneName: "short",
    });
  } catch {
    return iso;
  }
}

export function KeyTimes({ deal, isSeller }: KeyTimesProps) {
  const items: { label: string; value: string | null }[] = [
    { label: "Consultation scheduled", value: formatDate(deal.scheduled_at) },
    {
      label: "Available to complete from",
      value: deal.status === "Funded" ? formatDate(deal.mark_completed_after) : null,
    },
    { label: "Completed at", value: deal.completed_at ? formatDate(deal.completed_at) : null },
    {
      label: "Release / dispute deadline",
      value: !isSeller && deal.release_deadline_at ? formatDate(deal.release_deadline_at) : null,
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
