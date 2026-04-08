"use client";

// Shows a clear notice for terminal / unavailable link states.

type NoticeType = "cancelled" | "consumed_indexing" | "error" | "expired" | "not_found";

interface StatusNoticeProps {
  type: NoticeType;
  message?: string;
}

const config: Record<NoticeType, { bg: string; border: string; color: string; icon: string; title: string; body: string }> = {
  cancelled: {
    bg: "var(--warning-muted)",
    border: "var(--warning)",
    color: "var(--warning)",
    icon: "✕",
    title: "Link cancelled",
    body: "This consultation link has been cancelled by the seller.",
  },
  consumed_indexing: {
    bg: "var(--accent-muted)",
    border: "var(--accent)",
    color: "var(--accent)",
    icon: "⏳",
    title: "Deal indexing…",
    body: "Funding was confirmed on chain. Waiting for the deal to be indexed.",
  },
  error: {
    bg: "var(--danger-muted)",
    border: "var(--danger)",
    color: "var(--danger)",
    icon: "!",
    title: "Something went wrong",
    body: "Failed to load this link. Please refresh and try again.",
  },
  expired: {
    bg: "var(--warning-muted)",
    border: "var(--warning)",
    color: "var(--warning)",
    icon: "⏰",
    title: "Link expired",
    body: "This consultation link has passed its booking deadline.",
  },
  not_found: {
    bg: "var(--muted-bg)",
    border: "var(--border)",
    color: "var(--muted)",
    icon: "?",
    title: "Link not found",
    body: "This consultation link does not exist or has been removed.",
  },
};

export function StatusNotice({ type, message }: StatusNoticeProps) {
  const c = config[type];

  return (
    <div
      style={{
        background: c.bg,
        border: `1px solid ${c.border}`,
        borderRadius: "var(--radius)",
        padding: 20,
      }}
    >
      <div style={{ alignItems: "center", display: "flex", gap: 10, marginBottom: 8 }}>
        <span
          style={{
            background: c.color,
            borderRadius: "50%",
            color: "#fff",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            fontWeight: 700,
            height: 24,
            width: 24,
            flexShrink: 0,
          }}
        >
          {c.icon}
        </span>
        <strong style={{ color: c.color, fontSize: 15 }}>{c.title}</strong>
      </div>
      <p style={{ color: c.color, fontSize: 14, margin: 0, opacity: 0.85 }}>
        {message || c.body}
      </p>
    </div>
  );
}
